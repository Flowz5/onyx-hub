// =====================================================================
// SERVICE D'ENVOI D'IMAGES VERS FIREBASE STORAGE
// =====================================================================

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

// Taille maximale d'une image envoyée (5 Mo), alignée sur les règles Storage
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Formats d'image acceptés
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

// Envoi d'une image dans l'espace personnel de l'utilisateur et récupération de son URL publique
export const uploadImage = async (file: File, userId: string): Promise<string> => {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Format non pris en charge : utilisez une image PNG, JPEG, GIF ou WebP.");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Image trop lourde : la taille maximale est de 5 Mo.");
  }

  // Nom de fichier assaini et horodaté pour éviter les collisions
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
  const imageRef = ref(storage, `uploads/${userId}/${Date.now()}-${safeName}`);

  await uploadBytes(imageRef, file, { contentType: file.type });
  return getDownloadURL(imageRef);
};
