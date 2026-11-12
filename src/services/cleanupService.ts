// =====================================================================
// SERVICE DE NETTOYAGE DES DONNÉES ORPHELINES
// Firestore ne supprime ni les sous-collections ni les documents liés en cascade :
// à la suppression (ou modification) d'un contenu, les images qu'il référençait
// et les notifications qu'il avait générées sont retirées par son auteur.
// Ces opérations sont « au mieux » : un échec n'empêche jamais l'action principale.
// =====================================================================

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { ONYX_IMAGE_PREFIX } from "./imageService";

const IMAGES_COLLECTION = "images";
const NOTIFICATIONS_COLLECTION = "notifications";

// Limite d'écritures par lot, avec une marge sous le maximum Firestore de 500
export const MAX_BATCH_WRITES = 450;

// Identifiants des images internes référencées dans un ou plusieurs contenus Markdown
export const extractImageIds = (...contents: string[]): string[] => {
  const pattern = new RegExp(`${ONYX_IMAGE_PREFIX}([A-Za-z0-9]+)`, "g");
  const ids = new Set<string>();
  contents.forEach((content) => {
    for (const match of content.matchAll(pattern)) ids.add(match[1]);
  });
  return Array.from(ids);
};

// Suppression des images dont l'utilisateur est propriétaire
// (une image appartenant à un autre étudiant est refusée par les règles et ignorée)
export const deleteOwnedImages = async (imageIds: string[]): Promise<void> => {
  await Promise.allSettled(imageIds.map((id) => deleteDoc(doc(db, IMAGES_COLLECTION, id))));
};

// Images retirées d'un contenu lors de sa modification
export const deleteRemovedImages = async (previousContent: string, nextContent: string) => {
  const kept = new Set(extractImageIds(nextContent));
  await deleteOwnedImages(extractImageIds(previousContent).filter((id) => !kept.has(id)));
};

// Suppression des notifications générées par un étudiant pour un contenu
// (toutes celles d'un post ou d'un ticket, ou seulement celles d'un message précis)
export const deleteActorNotifications = async (
  actorId: string,
  parentId: string,
  messageId?: string
): Promise<void> => {
  const constraints = [where("actorId", "==", actorId), where("parentId", "==", parentId)];
  if (messageId) constraints.push(where("messageId", "==", messageId));
  const snapshot = await getDocs(query(collection(db, NOTIFICATIONS_COLLECTION), ...constraints));

  for (let start = 0; start < snapshot.docs.length; start += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    snapshot.docs.slice(start, start + MAX_BATCH_WRITES).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};

// Nettoyage complet après suppression d'un contenu par son auteur
export const cleanupAfterDeletion = async (
  actorId: string,
  parentId: string,
  contents: string[],
  messageId?: string
): Promise<void> => {
  const results = await Promise.allSettled([
    deleteActorNotifications(actorId, parentId, messageId),
    deleteOwnedImages(extractImageIds(...contents)),
  ]);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.warn("Nettoyage partiel après suppression :", result.reason);
    }
  });
};

// Message d'un fil supprimé avec son parent (pour le nettoyage de ses images)
export interface DeletedThreadMessage {
  authorId: string;
  content: string;
}

// Suppression d'un post ou d'un ticket avec tous les messages de son fil.
// Le dernier lot contient le parent et les écritures associées (compteurs) ;
// les messages d'un fil très long sont supprimés au préalable par lots successifs.
export const deleteParentWithThread = async (
  parentCollection: "posts" | "tickets",
  subcollection: "comments" | "replies",
  parentId: string,
  addParentWrites: (batch: WriteBatch) => Promise<void>
): Promise<DeletedThreadMessage[]> => {
  const snapshot = await getDocs(collection(db, parentCollection, parentId, subcollection));
  const messages = snapshot.docs;
  // Places réservées dans le dernier lot : parent, canal et profil de l'auteur
  const finalBatchCapacity = MAX_BATCH_WRITES - 5;

  let index = 0;
  while (messages.length - index > finalBatchCapacity) {
    const batch = writeBatch(db);
    messages.slice(index, index + MAX_BATCH_WRITES).forEach((d) => batch.delete(d.ref));
    await batch.commit();
    index += MAX_BATCH_WRITES;
  }

  const finalBatch = writeBatch(db);
  messages.slice(index).forEach((d) => finalBatch.delete(d.ref));
  finalBatch.delete(doc(db, parentCollection, parentId));
  await addParentWrites(finalBatch);
  await finalBatch.commit();

  return messages.map((d) => ({
    authorId: d.data().authorId || "",
    content: d.data().content || "",
  }));
};
