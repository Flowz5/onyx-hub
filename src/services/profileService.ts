// =====================================================================
// SERVICE FIRESTORE DES PROFILS PUBLICS (collection users)
// Le profil est créé à la première connexion ; les compteurs de posts et de tickets
// sont alors initialisés à partir des contenus déjà publiés par l'étudiant.
// =====================================================================

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getCountFromServer,
  serverTimestamp,
  increment,
  type WriteBatch,
  Timestamp,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { updateProfile, type User } from "firebase/auth";
import { db } from "./firebase";
import {
  AVATAR_SIZE,
  MAX_AVATAR_ENCODED_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  type EditableProfileFields,
  type UserProfile,
} from "../types/profile";

const USERS_COLLECTION = "users";

// Nom affiché par défaut : pseudo Firebase Auth, sinon partie locale de l'e-mail
export const defaultDisplayName = (user: Pick<User, "displayName" | "email">): string => {
  const name = user.displayName?.trim() || user.email?.split("@")[0] || "Étudiant";
  return name.padEnd(2, "_").slice(0, MAX_DISPLAY_NAME_LENGTH);
};

const mapProfile = (uid: string, data: DocumentData): UserProfile => ({
  uid,
  displayName: data.displayName || "Étudiant",
  bio: data.bio || "",
  photoDataUrl: data.photoDataUrl || null,
  postsCount: data.postsCount || 0,
  ticketsCount: data.ticketsCount || 0,
  solutionsCount: data.solutionsCount || 0,
  createdAt:
    data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : new Date().toISOString(),
});

// ---------------------------------------------------------------------
// Création du profil à la première connexion
// ---------------------------------------------------------------------

// Création en cours par utilisateur, partagée entre les appels simultanés (session et inscription)
const pendingProfileCreations = new Map<string, Promise<void>>();

// Comptage des contenus déjà publiés (les règles autorisent la lecture de ses propres contenus)
const countAuthoredDocuments = async (collectionName: string, uid: string): Promise<number> => {
  const snapshot = await getCountFromServer(
    query(collection(db, collectionName), where("authorId", "==", uid))
  );
  return snapshot.data().count;
};

// Vérification de l'existence du profil et création si nécessaire
export const ensureUserProfile = (user: User): Promise<void> => {
  const pending = pendingProfileCreations.get(user.uid);
  if (pending) return pending;

  const creation = (async () => {
    const profileRef = doc(db, USERS_COLLECTION, user.uid);
    const snapshot = await getDoc(profileRef);
    if (snapshot.exists()) return;

    const [postsCount, ticketsCount] = await Promise.all([
      countAuthoredDocuments("posts", user.uid),
      countAuthoredDocuments("tickets", user.uid),
    ]);
    await setDoc(profileRef, {
      displayName: defaultDisplayName(user),
      bio: "",
      photoDataUrl: null,
      postsCount,
      ticketsCount,
      solutionsCount: 0,
      createdAt: serverTimestamp(),
    });
  })();

  pendingProfileCreations.set(user.uid, creation);
  // En cas d'échec, une nouvelle tentative reste possible
  creation.catch(() => pendingProfileCreations.delete(user.uid));
  return creation;
};

// Ajout au lot d'écriture du décalage d'un compteur du profil (posts ou tickets).
// Ignoré si le profil n'existe pas encore ou si le compteur passerait sous zéro,
// afin de ne jamais faire échouer la publication ou la suppression du contenu.
export const addProfileCounterStep = async (
  batch: WriteBatch,
  uid: string,
  field: "postsCount" | "ticketsCount",
  step: 1 | -1
): Promise<void> => {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid));
  if (!snapshot.exists()) return;
  if (step < 0 && (snapshot.data()[field] || 0) <= 0) return;
  batch.update(snapshot.ref, { [field]: increment(step) });
};

// ---------------------------------------------------------------------
// Modification du profil
// ---------------------------------------------------------------------

// Enregistrement des champs modifiables ; le pseudo Firebase Auth est synchronisé
// afin que les nouveaux contenus portent le nouveau nom
export const updateUserProfile = async (
  user: User,
  fields: EditableProfileFields
): Promise<void> => {
  await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
    displayName: fields.displayName,
    bio: fields.bio,
    photoDataUrl: fields.photoDataUrl,
  });
  if (user.displayName !== fields.displayName) {
    await updateProfile(user, { displayName: fields.displayName });
  }
};

// Recadrage carré centré et compression de la photo de profil
export const compressAvatar = async (file: File): Promise<string> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choisissez un fichier image (PNG, JPEG, GIF ou WebP).");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Impossible de lire cette image."));
      element.src = objectUrl;
    });

    const side = Math.min(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Compression d'image indisponible sur ce navigateur.");
    context.drawImage(
      image,
      (image.width - side) / 2,
      (image.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE
    );

    for (const quality of [0.85, 0.7, 0.55]) {
      // WebP en priorité, JPEG si le navigateur ne sait pas encoder le WebP
      let dataUrl = canvas.toDataURL("image/webp", quality);
      if (!dataUrl.startsWith("data:image/webp")) {
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      if (dataUrl.length <= MAX_AVATAR_ENCODED_LENGTH) return dataUrl;
    }
    throw new Error("Image trop détaillée, même après compression.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

// ---------------------------------------------------------------------
// Cache partagé des profils affichés (avatars et noms des auteurs)
// Un seul écouteur Firestore par profil, quel que soit le nombre de composants abonnés.
// ---------------------------------------------------------------------

interface ProfileEntry {
  // undefined : chargement en cours ; null : profil inexistant
  profile: UserProfile | null | undefined;
  listeners: Set<() => void>;
  unsubscribe: Unsubscribe | null;
}

const profileEntries = new Map<string, ProfileEntry>();

const getEntry = (uid: string): ProfileEntry => {
  let entry = profileEntries.get(uid);
  if (!entry) {
    entry = { profile: undefined, listeners: new Set(), unsubscribe: null };
    profileEntries.set(uid, entry);
  }
  return entry;
};

// Abonnement d'un composant au profil d'un étudiant
export const watchUserProfile = (uid: string, onChange: () => void): (() => void) => {
  const entry = getEntry(uid);
  entry.listeners.add(onChange);

  if (!entry.unsubscribe) {
    entry.unsubscribe = onSnapshot(
      doc(db, USERS_COLLECTION, uid),
      (snapshot) => {
        entry.profile = snapshot.exists() ? mapProfile(uid, snapshot.data()) : null;
        entry.listeners.forEach((listener) => listener());
      },
      (error) => {
        console.error("Erreur écoute du profil :", error);
        entry.profile = null;
        entry.listeners.forEach((listener) => listener());
      }
    );
  }

  return () => {
    entry.listeners.delete(onChange);
    // Arrêt de l'écoute lorsque plus aucun composant n'affiche ce profil ; le dernier état reste en cache
    if (entry.listeners.size === 0 && entry.unsubscribe) {
      entry.unsubscribe();
      entry.unsubscribe = null;
    }
  };
};

// Dernier état connu du profil d'un étudiant
export const getCachedUserProfile = (uid: string): UserProfile | null | undefined =>
  profileEntries.get(uid)?.profile;
