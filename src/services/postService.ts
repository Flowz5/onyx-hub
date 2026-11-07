// =====================================================================
// SERVICE FIRESTORE DÉDIÉ AUX POSTS ET DISCUSSIONS D'UN CANAL
// =====================================================================

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
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

const POSTS_COLLECTION = "posts";

// Création d'un post rattaché à un canal spécifique
export const createPostInFirestore = async (
  channelId: string,
  formData: NewPostFormData,
  user: { uid: string; displayName?: string | null; email?: string | null }
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

  const docRef = await addDoc(collection(db, POSTS_COLLECTION), postData);
  return docRef.id;
};

// Suppression d'un post
export const deletePostFromFirestore = async (postId: string): Promise<void> => {
  const postDocRef = doc(db, POSTS_COLLECTION, postId);
  await deleteDoc(postDocRef);
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

  return onSnapshot(
    postsQuery,
    (snapshot) => {
      const posts: Post[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
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
        };
      });
      onPostsUpdate(posts);
    },
    (error) => {
      console.warn("Écoute ordonnée des posts échouée, fallback requête simple :", error);
      // Fallback si l'index composé (channelId + createdAt) n'est pas encore créé
      const fallbackQuery = query(postsRef, where("channelId", "==", channelId));
      return onSnapshot(
        fallbackQuery,
        (fallbackSnap) => {
          const fallbackPosts: Post[] = fallbackSnap.docs.map((docSnap) => {
            const data = docSnap.data();
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
};
