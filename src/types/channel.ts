// =====================================================================
// DÉFINITION DES TYPES ET INTERFACES LIÉS AUX CANAUX DE DISCUSSION
// =====================================================================

// Structure complète d'un canal de cours ou d'entraide
export interface Channel {
  id: string;
  name: string;
  description: string;
  tags: string[];
  visibility: "public" | "private";
  creatorId: string;
  createdBy: string;
  createdAt: string;
  ticketsCount: number;
  postsCount: number;
  // Adresses e-mail (en minuscules) des membres invités sur un canal privé
  memberEmails: string[];
}

// Données requises issues du formulaire de création d'un canal
export interface NewChannelFormData {
  name: string;
  description: string;
  tags: string[];
  visibility: "public" | "private";
  // Adresses e-mail des membres invités (ignorées pour un canal public)
  memberEmails: string[];
}

// Nombre maximal de membres invités sur un canal privé
export const MAX_CHANNEL_MEMBERS = 50;

// Normalisation d'une adresse e-mail pour la comparaison et le stockage
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

// Vérification simple du format d'une adresse e-mail
export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
