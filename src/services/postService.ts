// =====================================================================
// SERVICE FIRESTORE DÉDIÉ AUX POSTS ET DISCUSSIONS D'UN CANAL
// =====================================================================

import {
  collection,
  doc,
  updateDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Post, NewPostFormData } from "../types/post";
import { addProfileCounterStep } from "./profileService";
import { addModeratedCounterStep } from "./moderationService";
import { addMentionNotifications } from "./notificationService";
import { cleanupAfterDeletion, deleteParentWithThread, deleteRemovedImages } from "./cleanupService";
import type { MentionTarget } from "../types/mention";

const POSTS_COLLECTION = "posts";
const CHANNELS_COLLECTION = "channels";

// Création d'un post rattaché à un canal spécifique.
// L'écriture est atomique : le post est créé, les compteurs du canal et du profil de l'auteur incrémentés.
export const createPostInFirestore = async (
  channelId: string,
  formData: NewPostFormData,
  user: { uid: string; displayName?: string | null; email?: string | null },
  // Étudiants mentionnés dans le contenu, notifiés dans le même lot
  mentions: MentionTarget[] = []
): Promise<string> => {
  const postData = {
    channelId,
    title: formData.title,
    content: formData.content,
    tags: formData.tags,
    authorId: user.uid,
    authorName: user.displayName || user.email || "Étudiant",
    createdAt: serverTimestamp(),
    upvotesCount: 0,
    upvotedBy: [],
    commentsCount: 0,
  };

  // Génération préalable de la référence afin de l'inclure dans le lot d'écriture
  const postDocRef = doc(collection(db, POSTS_COLLECTION));
  const batch = writeBatch(db);
  batch.set(postDocRef, postData);
  batch.update(doc(db, CHANNELS_COLLECTION, channelId), {
    postsCount: increment(1),
  });
  await addProfileCounterStep(batch, user.uid, "postsCount", 1);
  addMentionNotifications(
    batch,
    "posts",
    postDocRef.id,
    null,
    { title: formData.title, channelId },
    { uid: user.uid, name: postData.authorName },
    mentions
  );
  await batch.commit();

  return postDocRef.id;
};

// Modification d'un post par son auteur (titre, contenu et tags uniquement).
// Les images retirées du contenu sont ensuite supprimées.
export const updatePostInFirestore = async (
  postId: string,
  formData: NewPostFormData,
  previousContent: string
): Promise<void> => {
  await updateDoc(doc(db, POSTS_COLLECTION, postId), {
    title: formData.title,
    content: formData.content,
    tags: formData.tags,
  });
  await deleteRemovedImages(previousContent, formData.content).catch((error) =>
    console.warn("Nettoyage des images retirées du post :", error)
  );
};

// Suppression d'un post par son auteur ou par un modérateur du canal, avec ses commentaires,
// décrémentation des compteurs du canal et du profil de l'auteur, puis nettoyage
// de ses images (et de celles des commentaires de l'auteur) et des notifications qu'il a générées
export const deletePostFromFirestore = async (post: Post, deleterId: string): Promise<void> => {
  const authorId = post.authorId;
  const deletedComments = await deleteParentWithThread("posts", "comments", post.id, async (batch) => {
    batch.update(doc(db, CHANNELS_COLLECTION, post.channelId), {
      postsCount: increment(-1),
    });
    // Le compteur d'un autre étudiant n'est modifiable que par la voie de modération
    if (deleterId === authorId) {
      await addProfileCounterStep(batch, authorId, "postsCount", -1);
    } else {
      await addModeratedCounterStep(batch, authorId, "postsCount", post.id);
    }
  });
  const ownContents = deletedComments
    .filter((comment) => comment.authorId === authorId)
    .map((comment) => comment.content);
  await cleanupAfterDeletion(authorId, post.id, post.channelId, [post.content, ...ownContents]);
};

// Bascule du vote positif (upvote) d'un étudiant sur un post
export const togglePostUpvote = async (
  postId: string,
  userId: string,
  isCurrentlyUpvoted: boolean
): Promise<void> => {
  const postDocRef = doc(db, POSTS_COLLECTION, postId);
  if (isCurrentlyUpvoted) {
    await updateDoc(postDocRef, {
      upvotedBy: arrayRemove(userId),
      upvotesCount: increment(-1),
    });
  } else {
    await updateDoc(postDocRef, {
      upvotedBy: arrayUnion(userId),
      upvotesCount: increment(1),
    });
  }
};

// Écoute en temps réel des posts d'un canal
export const subscribeToChannelPosts = (
  channelId: string,
  onPostsUpdate: (posts: Post[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const postsRef = collection(db, POSTS_COLLECTION);
  const postsQuery = query(
    postsRef,
    where("channelId", "==", channelId),
    orderBy("createdAt", "desc")
  );

  // Référence vers l'écouteur de repli, afin de pouvoir le désabonner lui aussi
  let fallbackUnsubscribe: Unsubscribe | null = null;

  const mainUnsubscribe = onSnapshot(
    postsQuery,
    (snapshot) => {
      const posts: Post[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data({ serverTimestamps: "estimate" });
        return {
          id: docSnap.id,
          channelId: data.channelId || channelId,
          title: data.title || "",
          content: data.content || "",
          tags: data.tags || [],
          authorId: data.authorId || "",
          authorName: data.authorName || "Étudiant",
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString(),
          upvotesCount: data.upvotesCount || 0,
          upvotedBy: data.upvotedBy || [],
          commentsCount: data.commentsCount || 0,
          pinnedAt: data.pinnedAt?.toDate ? data.pinnedAt.toDate().toISOString() : null,
        };
      });
      onPostsUpdate(posts);
    },
    (error) => {
      console.warn("Écoute ordonnée des posts échouée, fallback requête simple :", error);
      // Fallback si l'index composé (channelId + createdAt) n'est pas encore créé
      const fallbackQuery = query(postsRef, where("channelId", "==", channelId));
      fallbackUnsubscribe = onSnapshot(
        fallbackQuery,
        (fallbackSnap) => {
          const fallbackPosts: Post[] = fallbackSnap.docs.map((docSnap) => {
            const data = docSnap.data({ serverTimestamps: "estimate" });
            return {
              id: docSnap.id,
              channelId: data.channelId || channelId,
              title: data.title || "",
              content: data.content || "",
              tags: data.tags || [],
              authorId: data.authorId || "",
              authorName: data.authorName || "Étudiant",
              createdAt: data.createdAt?.toDate
                ? data.createdAt.toDate().toISOString()
                : new Date().toISOString(),
              upvotesCount: data.upvotesCount || 0,
              upvotedBy: data.upvotedBy || [],
              commentsCount: data.commentsCount || 0,
              pinnedAt: data.pinnedAt?.toDate ? data.pinnedAt.toDate().toISOString() : null,
            };
          });
          // Tri côté client
          fallbackPosts.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          onPostsUpdate(fallbackPosts);
        },
        (err) => {
          console.error("Erreur écoute des posts :", err);
          if (onError) onError(err);
        }
      );
    }
  );

  // Désabonnement global : écouteur principal et écouteur de repli éventuel
  return () => {
    mainUnsubscribe();
    if (fallbackUnsubscribe) fallbackUnsubscribe();
  };
};
