// =====================================================================
// SERVICE FIRESTORE DES FILS DE DISCUSSION
// Réponses aux tickets : tickets/{ticketId}/replies (compteur repliesCount)
// Commentaires des posts : posts/{postId}/comments (compteur commentsCount)
// =====================================================================

import {
  collection,
  doc,
  writeBatch,
  increment,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ThreadKind, ThreadMessage } from "../types/thread";
import type { MentionTarget } from "../types/mention";
import {
  addMentionNotifications,
  buildThreadNotificationData,
  newNotificationRef,
  type NotificationParent,
} from "./notificationService";

// Correspondance entre type de fil, sous-collection et compteur du document parent
const THREAD_CONFIG: Record<
  ThreadKind,
  { subcollection: string; counterField: string; notificationType: "ticket_reply" | "post_comment" }
> = {
  tickets: { subcollection: "replies", counterField: "repliesCount", notificationType: "ticket_reply" },
  posts: { subcollection: "comments", counterField: "commentsCount", notificationType: "post_comment" },
};

// Ajout d'un message dans un fil.
// L'écriture est atomique : le message est créé, le compteur du parent incrémenté
// et l'auteur du parent notifié (sauf s'il répond lui-même).
export const addThreadMessage = async (
  kind: ThreadKind,
  parent: NotificationParent & { id: string },
  content: string,
  user: { uid: string; displayName?: string | null; email?: string | null },
  // Étudiants mentionnés dans le message (l'auteur du parent, déjà notifié, en est exclu)
  mentions: MentionTarget[] = []
): Promise<void> => {
  const { subcollection, counterField, notificationType } = THREAD_CONFIG[kind];
  const authorName = user.displayName || user.email || "Étudiant";
  const messageRef = doc(collection(db, kind, parent.id, subcollection));
  const batch = writeBatch(db);
  batch.set(messageRef, {
    content,
    authorId: user.uid,
    authorName,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, kind, parent.id), { [counterField]: increment(1) });
  if (parent.authorId && parent.authorId !== user.uid) {
    batch.set(
      newNotificationRef(),
      buildThreadNotificationData(notificationType, parent.id, messageRef.id, parent, {
        uid: user.uid,
        name: authorName,
      })
    );
  }
  addMentionNotifications(
    batch,
    kind,
    parent.id,
    messageRef.id,
    parent,
    { uid: user.uid, name: authorName },
    mentions.filter((mention) => mention.uid !== parent.authorId)
  );
  await batch.commit();
};

// Suppression d'un message par son auteur et décrémentation atomique du compteur du parent
export const deleteThreadMessage = async (
  kind: ThreadKind,
  parentId: string,
  messageId: string
): Promise<void> => {
  const { subcollection, counterField } = THREAD_CONFIG[kind];
  const batch = writeBatch(db);
  batch.delete(doc(db, kind, parentId, subcollection, messageId));
  batch.update(doc(db, kind, parentId), { [counterField]: increment(-1) });
  await batch.commit();
};

// Écoute en temps réel des messages d'un fil, du plus ancien au plus récent
export const subscribeToThreadMessages = (
  kind: ThreadKind,
  parentId: string,
  onMessagesUpdate: (messages: ThreadMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const { subcollection } = THREAD_CONFIG[kind];
  const messagesQuery = query(
    collection(db, kind, parentId, subcollection),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages: ThreadMessage[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          parentId,
          content: data.content || "",
          authorId: data.authorId || "",
          authorName: data.authorName || "Étudiant",
          // Horodatage local en attendant la confirmation du serveur
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString(),
        };
      });
      onMessagesUpdate(messages);
    },
    (error) => {
      console.error("Erreur écoute du fil de discussion :", error);
      if (onError) onError(error);
    }
  );
};
