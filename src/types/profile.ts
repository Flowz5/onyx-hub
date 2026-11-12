// =====================================================================
// DÉFINITION DES TYPES DU PROFIL PUBLIC D'UN ÉTUDIANT
// =====================================================================

// Profil public d'un étudiant (document users/{uid}, lisible par tous les membres connectés)
export interface UserProfile {
  uid: string;
  displayName: string;
  bio: string;
  // Photo de profil carrée compressée (data URL WebP ou JPEG), null si aucune
  photoDataUrl: string | null;
  postsCount: number;
  ticketsCount: number;
  // Nombre de réponses retenues comme solution d'un ticket
  solutionsCount: number;
  createdAt: string;
}

// Champs modifiables par l'étudiant depuis sa page profil
export interface EditableProfileFields {
  displayName: string;
  bio: string;
  photoDataUrl: string | null;
}

// Bornes de validation, alignées sur les règles Firestore
export const MIN_DISPLAY_NAME_LENGTH = 2;
export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_BIO_LENGTH = 200;
// Côté et taille maximale de la photo de profil encodée
export const AVATAR_SIZE = 256;
export const MAX_AVATAR_ENCODED_LENGTH = 120_000;
