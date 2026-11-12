// =====================================================================
// SERVICE FIRESTORE DU CENTRE DE NOTIFICATIONS
// notifications/{id} : réponses à mes tickets et commentaires de mes posts,
//   écrites par l'auteur du message dans le même lot que celui-ci.
// notificationSettings/{uid} : préférences et état de lecture des nouveaux posts.
// Les nouveaux posts ne sont pas diffusés (pas de Cloud Functions sur le forfait Spark) :
// ils sont déduits des posts récents des canaux accessibles.
// =====================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  Timestamp,
  type DocumentData,
  type Unsubscribe,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  MAX_READ_POST_IDS,
  type NotificationPreferences,
  type NotificationSettings,
  type ThreadNotificationType,
} from "../types/notification";
import type { MentionTarget } from "../types/mention";

const NOTIFICATIONS_COLLECTION = "notifications";
const SETTINGS_COLLECTION = "notificationSettings";
const POSTS_COLLECTION = "posts";

// Nombre de notifications de fil chargées et de posts récents examinés par canal
const MAX_THREAD_NOTIFICATIONS = 30;
const RECENT_POSTS_PER_CHANNEL = 5;

// Conversion d'un horodatage Firestore (éventuellement en attente du serveur) en ISO
const toIsoDate = (value: unknown): string =>
  value instanceof Timestamp ? value.toDate().toISOString() : new Date().toISOString();

// ---------------------------------------------------------------------
// Notifications de fil (réponses et commentaires)
// ---------------------------------------------------------------------

// Notification de fil telle que lue depuis Firestore
export interface ThreadNotification {
  id: string;
  type: ThreadNotificationType;
  actorName: string;
  parentId: string;
  parentTitle: string;
  channelId: string;
  createdAt: string;
  read: boolean;
  // Message (réponse ou commentaire) concerné ; null pour une mention dans le corps d'un post ou d'un ticket
  messageId: string | null;
}

// Parent d'un message (ticket ou post) nécessaire à l'écriture d'une notification
export interface NotificationParent {
  authorId: string;
  title: string;
  channelId: string;
}

// Données d'une notification destinée à l'auteur du parent.
// Elles sont ajoutées au lot d'écriture du message par le service des fils.
export const buildThreadNotificationData = (
  type: ThreadNotificationType,
  parentId: string,
  messageId: string,
  parent: NotificationParent,
  actor: { uid: string; name: string }
) => ({
  recipientId: parent.authorId,
  actorId: actor.uid,
  actorName: actor.name,
  type,
  parentId,
  messageId,
  parentTitle: parent.title,
  channelId: parent.channelId,
  createdAt: serverTimestamp(),
  read: false,
});

// Ajout au lot d'écriture des notifications de mention d'un contenu.
// Le contenu (post, ticket, réponse ou commentaire) doit être créé dans le même lot :
// les règles Firestore vérifient qu'il contient bien la mention de chaque destinataire.
export const addMentionNotifications = (
  batch: WriteBatch,
  kind: "posts" | "tickets",
  parentId: string,
  messageId: string | null,
  parent: Omit<NotificationParent, "authorId">,
  actor: { uid: string; name: string },
  targets: MentionTarget[]
): void => {
  targets.forEach((target) => {
    batch.set(newNotificationRef(), {
      recipientId: target.uid,
      actorId: actor.uid,
      actorName: actor.name,
      type: kind === "posts" ? "post_mention" : "ticket_mention",
      parentId,
      messageId,
      parentTitle: parent.title,
      channelId: parent.channelId,
      createdAt: serverTimestamp(),
      read: false,
      // E-mail d'invitation, utilisé par les règles pour vérifier l'accès à un canal privé
      ...(target.email ? { recipientEmail: target.email } : {}),
    });
  });
};

// Référence d'un nouveau document de notification (pour un lot d'écriture)
export const newNotificationRef = () => doc(collection(db, NOTIFICATIONS_COLLECTION));

const mapThreadNotification = (id: string, data: DocumentData): ThreadNotification => ({
  id,
  type: ["post_comment", "post_mention", "ticket_mention"].includes(data.type)
    ? data.type
    : "ticket_reply",
  messageId: data.messageId ?? null,
  actorName: data.actorName || "Étudiant",
  parentId: data.parentId || "",
  parentTitle: data.parentTitle || "",
  channelId: data.channelId || "",
  createdAt: toIsoDate(data.createdAt),
  read: Boolean(data.read),
});

// Écoute en temps réel des notifications reçues, de la plus récente à la plus ancienne
export const subscribeToThreadNotifications = (
  userId: string,
  onUpdate: (notifications: ThreadNotification[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
  const orderedQuery = query(
    notificationsRef,
    where("recipientId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(MAX_THREAD_NOTIFICATIONS)
  );

  let fallbackUnsubscribe: Unsubscribe | null = null;

  const mainUnsubscribe = onSnapshot(
    orderedQuery,
    (snapshot) => onUpdate(snapshot.docs.map((d) => mapThreadNotification(d.id, d.data()))),
    (error) => {
      console.warn("Écoute ordonnée des notifications échouée, fallback requête simple :", error);
      // Fallback si l'index composé (recipientId + createdAt) n'est pas encore créé
      fallbackUnsubscribe = onSnapshot(
        query(notificationsRef, where("recipientId", "==", userId)),
        (snapshot) => {
          const notifications = snapshot.docs
            .map((d) => mapThreadNotification(d.id, d.data()))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, MAX_THREAD_NOTIFICATIONS);
          onUpdate(notifications);
        },
        (err) => {
          console.error("Erreur écoute des notifications :", err);
          if (onError) onError(err);
        }
      );
    }
  );

  return () => {
    mainUnsubscribe();
    if (fallbackUnsubscribe) fallbackUnsubscribe();
  };
};

// Marquage d'une ou plusieurs notifications de fil comme lues
export const markThreadNotificationsRead = async (notificationIds: string[]): Promise<void> => {
  if (notificationIds.length === 0) return;
  const batch = writeBatch(db);
  notificationIds.forEach((id) =>
    batch.update(doc(db, NOTIFICATIONS_COLLECTION, id), { read: true })
  );
  await batch.commit();
};

// ---------------------------------------------------------------------
// Paramètres de notification (préférences et lecture des nouveaux posts)
// ---------------------------------------------------------------------

const mapSettings = (data: DocumentData): NotificationSettings => ({
  preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data.preferences || {}) },
  postsReadAt: toIsoDate(data.postsReadAt),
  readPostIds: Array.isArray(data.readPostIds) ? data.readPostIds : [],
  clearedAt: data.clearedAt ? toIsoDate(data.clearedAt) : null,
});

// Écoute des paramètres de l'utilisateur.
// À la première connexion, le document est créé : les posts déjà publiés sont considérés comme lus.
export const subscribeToNotificationSettings = (
  userId: string,
  onUpdate: (settings: NotificationSettings) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const settingsRef = doc(db, SETTINGS_COLLECTION, userId);

  return onSnapshot(
    settingsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(mapSettings(snapshot.data()));
        return;
      }
      setDoc(settingsRef, {
        preferences: DEFAULT_NOTIFICATION_PREFERENCES,
        postsReadAt: serverTimestamp(),
        readPostIds: [],
      }).catch((error) => {
        console.error("Erreur d'initialisation des paramètres de notification :", error);
        if (onError) onError(error);
      });
    },
    (error) => {
      console.error("Erreur écoute des paramètres de notification :", error);
      if (onError) onError(error);
    }
  );
};

// Enregistrement des préférences de notification
export const saveNotificationPreferences = async (
  userId: string,
  preferences: NotificationPreferences
): Promise<void> => {
  await updateDoc(doc(db, SETTINGS_COLLECTION, userId), { preferences });
};

// Marquage d'un nouveau post comme lu.
// Au-delà de la limite, les identifiants les plus anciens sont retirés de la liste.
export const markPostNotificationRead = async (userId: string, postId: string): Promise<void> => {
  const settingsRef = doc(db, SETTINGS_COLLECTION, userId);
  const snapshot = await getDoc(settingsRef);
  const readPostIds: string[] = snapshot.exists() ? snapshot.data().readPostIds || [] : [];
  if (readPostIds.includes(postId)) return;

  if (readPostIds.length < MAX_READ_POST_IDS) {
    await updateDoc(settingsRef, { readPostIds: arrayUnion(postId) });
  } else {
    await updateDoc(settingsRef, {
      readPostIds: [...readPostIds.slice(-(MAX_READ_POST_IDS - 1)), postId],
    });
  }
};

// Marquage de tous les nouveaux posts comme lus
export const markAllPostNotificationsRead = async (userId: string): Promise<void> => {
  await updateDoc(doc(db, SETTINGS_COLLECTION, userId), {
    postsReadAt: serverTimestamp(),
    readPostIds: [],
  });
};

// Effacement de toutes les notifications : suppression des notifications de fil reçues
// et masquage des nouveaux posts publiés jusqu'à maintenant
export const clearAllNotifications = async (userId: string): Promise<void> => {
  const snapshot = await getDocs(
    query(collection(db, NOTIFICATIONS_COLLECTION), where("recipientId", "==", userId))
  );

  // Lots de 450 suppressions au plus (limite Firestore : 500 écritures par lot)
  const BATCH_SIZE = 450;
  for (let start = 0; start < snapshot.docs.length; start += BATCH_SIZE) {
    const batch = writeBatch(db);
    snapshot.docs.slice(start, start + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  await updateDoc(doc(db, SETTINGS_COLLECTION, userId), {
    clearedAt: serverTimestamp(),
    postsReadAt: serverTimestamp(),
    readPostIds: [],
  });
};

// ---------------------------------------------------------------------
// Posts récents d'un canal (source des notifications de nouveaux posts)
// ---------------------------------------------------------------------

export interface RecentPost {
  id: string;
  channelId: string;
  title: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

// Écoute des derniers posts d'un canal (index channelId + createdAt déjà utilisé par le flux)
export const subscribeToRecentChannelPosts = (
  channelId: string,
  onUpdate: (posts: RecentPost[]) => void
): Unsubscribe =>
  onSnapshot(
    query(
      collection(db, POSTS_COLLECTION),
      where("channelId", "==", channelId),
      orderBy("createdAt", "desc"),
      limit(RECENT_POSTS_PER_CHANNEL)
    ),
    (snapshot) =>
      onUpdate(
        snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            channelId,
            title: data.title || "",
            authorId: data.authorId || "",
            authorName: data.authorName || "Étudiant",
            createdAt: toIsoDate(data.createdAt),
          };
        })
      ),
    (error) => console.error("Erreur écoute des posts récents du canal :", error)
  );
