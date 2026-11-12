// =====================================================================
// SERVICE D'IMAGES STOCKÉES DANS FIRESTORE (SANS FIREBASE STORAGE)
// Les images sont compressées côté navigateur (WebP) puis enregistrées
// en base64 dans la collection « images », dans la limite de 1 Mo par document.
// =====================================================================

import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const IMAGES_COLLECTION = "images";

// Préfixe des références d'images internes dans le contenu Markdown
export const ONYX_IMAGE_PREFIX = "onyx-image:";

// Formats acceptés en entrée (les GIF animés sont convertis en image fixe)
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

// Taille maximale du fichier source sélectionné (avant compression)
const MAX_SOURCE_SIZE = 15 * 1024 * 1024;

// Taille maximale de l'image encodée, alignée sur les règles Firestore (marge sous 1 Mo)
export const MAX_ENCODED_LENGTH = 700_000;

// Paliers de compression successifs : dimension maximale et qualité WebP
const COMPRESSION_STEPS = [
  { maxDimension: 1600, quality: 0.82 },
  { maxDimension: 1280, quality: 0.72 },
  { maxDimension: 1024, quality: 0.62 },
  { maxDimension: 800, quality: 0.55 },
];

// Chargement d'un fichier image dans un élément <img> exploitable par un canvas
const loadImageElement = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de lire cette image."));
    };
    image.src = objectUrl;
  });

// Compression progressive jusqu'à passer sous la taille maximale autorisée
const compressImage = async (file: File): Promise<string> => {
  const image = await loadImageElement(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Compression d'image indisponible sur ce navigateur.");

  for (const { maxDimension, quality } of COMPRESSION_STEPS) {
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    // WebP en priorité, JPEG si le navigateur ne sait pas encoder le WebP
    let dataUrl = canvas.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (dataUrl.length <= MAX_ENCODED_LENGTH) return dataUrl;
  }

  throw new Error("Image trop détaillée, même après compression. Essayez une capture plus petite.");
};

// Compression puis enregistrement d'une image ; retourne la référence à insérer dans le Markdown
export const uploadImage = async (file: File, userId: string): Promise<string> => {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Format non pris en charge : utilisez une image PNG, JPEG, GIF ou WebP.");
  }
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error("Image trop lourde : la taille maximale est de 15 Mo avant compression.");
  }

  const dataUrl = await compressImage(file);
  const docRef = await addDoc(collection(db, IMAGES_COLLECTION), {
    ownerId: userId,
    dataUrl,
    createdAt: serverTimestamp(),
  });
  return `${ONYX_IMAGE_PREFIX}${docRef.id}`;
};

// Cache mémoire des images déjà chargées, afin de limiter les lectures Firestore
const imageCache = new Map<string, Promise<string | null>>();

// Récupération du contenu (data URL) d'une image interne à partir de son identifiant
export const getImageDataUrl = (imageId: string): Promise<string | null> => {
  const cached = imageCache.get(imageId);
  if (cached) return cached;

  const request = getDoc(doc(db, IMAGES_COLLECTION, imageId))
    .then((snapshot) => (snapshot.exists() ? (snapshot.data().dataUrl as string) : null))
    .catch((error) => {
      console.error("Erreur de chargement de l'image :", error);
      imageCache.delete(imageId);
      return null;
    });

  imageCache.set(imageId, request);
  return request;
};
