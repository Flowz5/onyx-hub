// =====================================================================
// SERVICE FIRESTORE DÉDIÉ À LA GESTION DES CANAUX DE DISCUSSION
// =====================================================================

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { normalizeEmail, type Channel, type NewChannelFormData } from "../types/channel";

// Nom de la collection Firestore
const CHANNELS_COLLECTION = "channels";

// Conversion d'un document Firestore en objet Channel typé
const mapChannelDoc = (
  docSnap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>
): Channel => {
  const data = docSnap.data() || {};
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
    memberEmails: data.memberEmails || [],
  };
};

// Nettoyage d'une liste d'e-mails : normalisation et suppression des doublons
const cleanMemberEmails = (emails: string[]): string[] =>
  Array.from(new Set(emails.map(normalizeEmail).filter(Boolean)));

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
    // Les invitations ne concernent que les canaux privés
    memberEmails:
      formData.visibility === "private" ? cleanMemberEmails(formData.memberEmails) : [],
  };

  const docRef = await addDoc(collection(db, CHANNELS_COLLECTION), channelData);
  return docRef.id;
};

// Édition des paramètres d'un canal par son créateur (nom, description, tags, visibilité, membres).
// Le passage en public vide la liste des invitations, devenue sans objet.
export const updateChannelInFirestore = async (
  channelId: string,
  formData: NewChannelFormData
): Promise<void> => {
  await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
    name: formData.name,
    description: formData.description,
    tags: formData.tags,
    visibility: formData.visibility,
    memberEmails:
      formData.visibility === "private" ? cleanMemberEmails(formData.memberEmails) : [],
  });
};

// Mise à jour de la liste des membres invités d'un canal privé (réservée au créateur)
export const updateChannelMembers = async (
  channelId: string,
  memberEmails: string[]
): Promise<void> => {
  await updateDoc(doc(db, CHANNELS_COLLECTION, channelId), {
    memberEmails: cleanMemberEmails(memberEmails),
  });
};

// Suppression d'un canal dans Firestore
export const deleteChannelFromFirestore = async (
  channelId: string
): Promise<void> => {
  const channelDocRef = doc(db, CHANNELS_COLLECTION, channelId);
  await deleteDoc(channelDocRef);
};

// Récupération d'un canal unique par son identifiant.
// Retourne null si le canal n'existe pas ou si l'accès est refusé (canal privé non partagé).
export const getChannelById = async (
  channelId: string
): Promise<Channel | null> => {
  try {
    const snapshot = await getDoc(doc(db, CHANNELS_COLLECTION, channelId));
    if (!snapshot.exists()) {
      return null;
    }
    return mapChannelDoc(snapshot);
  } catch (error) {
    console.error("Erreur lors de la récupération du canal :", error);
    return null;
  }
};

// Écoute en temps réel des canaux accessibles à l'utilisateur connecté.
// Les règles Firestore n'étant pas des filtres, trois requêtes distinctes sont combinées :
// canaux publics, canaux créés par l'utilisateur et canaux privés où il est invité.
export const subscribeToChannels = (
  user: { uid: string; email?: string | null },
  onChannelsUpdate: (channels: Channel[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const channelsRef = collection(db, CHANNELS_COLLECTION);

  const sources = [
    query(channelsRef, where("visibility", "==", "public")),
    query(channelsRef, where("creatorId", "==", user.uid)),
  ];
  if (user.email) {
    sources.push(
      query(channelsRef, where("memberEmails", "array-contains", normalizeEmail(user.email)))
    );
  }

  // Résultats courants de chaque requête, fusionnés à chaque mise à jour
  const results: Map<string, Channel>[] = sources.map(() => new Map());
  const loaded: boolean[] = sources.map(() => false);

  const emitMergedChannels = () => {
    // Attente du premier retour de chaque requête pour éviter un affichage partiel
    if (loaded.some((isLoaded) => !isLoaded)) return;

    const merged = new Map<string, Channel>();
    results.forEach((result) => result.forEach((channel, id) => merged.set(id, channel)));

    // Tri côté client par date de création décroissante
    const channels = Array.from(merged.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    onChannelsUpdate(channels);
  };

  const unsubscribers = sources.map((source, index) =>
    onSnapshot(
      source,
      (snapshot) => {
        results[index] = new Map(snapshot.docs.map((docSnap) => [docSnap.id, mapChannelDoc(docSnap)]));
        loaded[index] = true;
        emitMergedChannels();
      },
      (error) => {
        console.error("Erreur d'écoute Firestore des canaux :", error);
        // La requête en échec est considérée vide afin de ne pas bloquer les autres
        results[index] = new Map();
        loaded[index] = true;
        emitMergedChannels();
        if (onError) onError(error);
      }
    )
  );

  // Désabonnement de l'ensemble des écouteurs
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
};
