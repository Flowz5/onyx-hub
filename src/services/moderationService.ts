// =====================================================================
// SERVICE DE MODÉRATION DES CANAUX
// Un canal est modéré par son créateur ; le compte administrateur modère
// l'ensemble des canaux et accède aussi aux canaux privés.
// Ces vérifications ne servent qu'à l'affichage : les règles Firestore
// (isSuperAdmin, isChannelModerator) restent la seule garantie de sécurité.
// =====================================================================
import { doc, getDoc, increment, type WriteBatch } from "firebase/firestore";
import { db } from "./firebase";
import { normalizeEmail, type Channel } from "../types/channel";

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
