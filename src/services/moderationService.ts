// =====================================================================
// SERVICE DE MODÉRATION DES CANAUX
// Un canal est modéré par son créateur ; le compte administrateur modère
// l'ensemble des canaux et accède aussi aux canaux privés.
// Ces vérifications ne servent qu'à l'affichage : les règles Firestore
// (isSuperAdmin, isChannelModerator) restent la seule garantie de sécurité.
// =====================================================================
import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { newNotificationRef } from "./notificationService";
import { normalizeEmail, type Channel } from "../types/channel";
import { MAX_WARNING_REASON_LENGTH } from "../types/notification";

// Adresse e-mail du compte administrateur, à garder identique à celle de firestore.rules
export const SUPER_ADMIN_EMAIL = "le.dupont.pro@gmail.com";

const USERS_COLLECTION = "users";

// Vérifie si l'utilisateur connecté est l'administrateur de la plateforme
export const isSuperAdmin = (user: { email?: string | null } | null | undefined): boolean =>
  Boolean(user?.email && normalizeEmail(user.email) === SUPER_ADMIN_EMAIL);

// Vérifie si l'utilisateur connecté peut modérer un canal (créateur ou administrateur)
export const canModerateChannel = (
  channel: Pick<Channel, "creatorId"> | null | undefined,
  user: { uid: string; email?: string | null } | null | undefined
): boolean => Boolean(channel && user && (channel.creatorId === user.uid || isSuperAdmin(user)));

// Décrémentation du compteur de posts ou de tickets de l'auteur d'un contenu supprimé par un modérateur.
// lastModeratedContentId permet aux règles Firestore de vérifier que ce contenu,
// supprimé dans le même lot, appartenait bien à cet étudiant et à un canal modéré par l'appelant.
export const addModeratedCounterStep = async (
  batch: WriteBatch,
  authorId: string,
  field: "postsCount" | "ticketsCount",
  contentId: string
): Promise<void> => {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, authorId));
  if (!snapshot.exists() || (snapshot.data()[field] || 0) <= 0) return;
  batch.update(snapshot.ref, {
    [field]: increment(-1),
    lastModeratedContentId: contentId,
  });
};

// Contenu visé par un avertissement : post ou ticket, éventuellement un message de son fil
export interface WarningTarget {
  kind: "posts" | "tickets";
  parentId: string;
  parentTitle: string;
  channelId: string;
  // Commentaire ou réponse visé ; null pour le post ou le ticket lui-même
  messageId: string | null;
  // Auteur du contenu, destinataire de l'avertissement
  recipientId: string;
}

// Envoi d'un avertissement de modération à l'auteur d'un contenu, sous forme de notification.
// Les règles Firestore vérifient que l'appelant modère le canal et que le destinataire est bien l'auteur.
export const sendModerationWarning = async (
  target: WarningTarget,
  reason: string,
  moderator: { uid: string; displayName?: string | null; email?: string | null }
): Promise<void> => {
  const trimmedReason = reason.trim().slice(0, MAX_WARNING_REASON_LENGTH);
  if (!trimmedReason) throw new Error("Le motif de l'avertissement est obligatoire.");
  await setDoc(newNotificationRef(), {
    recipientId: target.recipientId,
    actorId: moderator.uid,
    actorName: moderator.displayName || moderator.email || "Modérateur",
    type: target.kind === "posts" ? "post_warning" : "ticket_warning",
    parentId: target.parentId,
    messageId: target.messageId,
    parentTitle: target.parentTitle,
    channelId: target.channelId,
    createdAt: serverTimestamp(),
    read: false,
    reason: trimmedReason,
  });
};

// Épinglage (ou désépinglage) d'un post ou d'un ticket en tête du flux de son canal.
// L'horodatage serveur ordonne les éléments épinglés, du plus récent au plus ancien.
export const setContentPinned = async (
  kind: "posts" | "tickets",
  contentId: string,
  pinned: boolean
): Promise<void> => {
  await updateDoc(doc(db, kind, contentId), {
    pinnedAt: pinned ? serverTimestamp() : null,
  });
};

// Tri plaçant les éléments épinglés en tête (épinglage le plus récent d'abord),
// l'ordre existant étant conservé pour les autres éléments (tri stable)
export const sortPinnedFirst = <T extends { pinnedAt: string | null }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    if (a.pinnedAt && b.pinnedAt) return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
    if (a.pinnedAt) return -1;
    if (b.pinnedAt) return 1;
    return 0;
  });
