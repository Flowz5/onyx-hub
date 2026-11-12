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

// Correspondance entre type de fil, sous-collection et compteur du document parent
const THREAD_CONFIG: Record<ThreadKind, { subcollection: string; counterField: string }> = {
  tickets: { subcollection: "replies", counterField: "repliesCount" },
  posts: { subcollection: "comments", counterField: "commentsCount" },
};

// Ajout d'un message dans un fil.
// L'écriture est atomique : le message est créé et le compteur du parent incrémenté.
export const addThreadMessage = async (
  kind: ThreadKind,
  parentId: string,
  content: string,
  user: { uid: string; displayName?: string | null; email?: string | null }
): Promise<void> => {
  const { subcollection, counterField } = THREAD_CONFIG[kind];
  const messageRef = doc(collection(db, kind, parentId, subcollection));
  const batch = writeBatch(db);
  batch.set(messageRef, {
    content,
    authorId: user.uid,
    authorName: user.displayName || user.email || "Étudiant",
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, kind, parentId), { [counterField]: increment(1) });
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
