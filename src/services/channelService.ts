// =====================================================================
// SERVICE FIRESTORE DÉDIÉ À LA GESTION DES CANAUX DE DISCUSSION
// =====================================================================

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Channel, NewChannelFormData } from "../types/channel";

// Nom de la collection Firestore
const CHANNELS_COLLECTION = "channels";

// Création d'un nouveau canal dans Firestore
export const createChannelInFirestore = async (
  formData: NewChannelFormData,
  user: { uid: string; displayName?: string | null; email?: string | null }
): Promise<string> => {
  const channelData = {
    name: formData.name,
    description: formData.description,
    tags: formData.tags,
    visibility: formData.visibility,
    creatorId: user.uid,
    createdBy: user.displayName || user.email || "Étudiant",
    createdAt: serverTimestamp(),
    ticketsCount: 0,
    postsCount: 0,
  };

  const docRef = await addDoc(collection(db, CHANNELS_COLLECTION), channelData);
  return docRef.id;
};

// Suppression d'un canal dans Firestore
export const deleteChannelFromFirestore = async (
  channelId: string
): Promise<void> => {
  const channelDocRef = doc(db, CHANNELS_COLLECTION, channelId);
  await deleteDoc(channelDocRef);
};

// Récupération d'un canal unique par son identifiant
export const getChannelById = async (
  channelId: string
): Promise<Channel | null> => {
  try {
    const channelDocRef = doc(db, CHANNELS_COLLECTION, channelId);
    const snapshot = await getDoc(channelDocRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      id: snapshot.id,
      name: data.name || "",
      description: data.description || "",
      tags: data.tags || [],
      visibility: data.visibility || "public",
      creatorId: data.creatorId || "",
      createdBy: data.createdBy || "Étudiant",
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString(),
      ticketsCount: data.ticketsCount || 0,
      postsCount: data.postsCount || 0,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération du canal :", error);
    return null;
  }
};

// Écoute en temps réel des canaux avec fallback si l'index n'est pas encore prêt
export const subscribeToChannels = (
  onChannelsUpdate: (channels: Channel[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const channelsRef = collection(db, CHANNELS_COLLECTION);
  // Requête ordonnée par date de création décroissante
  const channelsQuery = query(channelsRef, orderBy("createdAt", "desc"));

  return onSnapshot(
    channelsQuery,
    (snapshot) => {
      const channelsList: Channel[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || "",
          description: data.description || "",
          tags: data.tags || [],
          visibility: data.visibility || "public",
          creatorId: data.creatorId || "",
          createdBy: data.createdBy || "Étudiant",
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString(),
          ticketsCount: data.ticketsCount || 0,
          postsCount: data.postsCount || 0,
        };
      });
      onChannelsUpdate(channelsList);
    },
    (error) => {
      console.warn("Écoute ordonnée échouée, bascule sur écoute simple :", error);
      // Fallback : écoute sans orderBy si un index manque
      return onSnapshot(
        channelsRef,
        (fallbackSnapshot) => {
          const channelsList: Channel[] = fallbackSnapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.name || "",
              description: data.description || "",
              tags: data.tags || [],
              visibility: data.visibility || "public",
              creatorId: data.creatorId || "",
              createdBy: data.createdBy || "Étudiant",
              createdAt: data.createdAt?.toDate
                ? data.createdAt.toDate().toISOString()
                : new Date().toISOString(),
              ticketsCount: data.ticketsCount || 0,
              postsCount: data.postsCount || 0,
            };
          });
          onChannelsUpdate(channelsList);
        },
        (fallbackError) => {
          console.error("Erreur d'écoute Firestore des canaux :", fallbackError);
          if (onError) onError(fallbackError);
        }
      );
    }
  );
};
