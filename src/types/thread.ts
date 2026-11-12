// =====================================================================
// DÉFINITION DES TYPES DES FILS DE DISCUSSION
// (réponses aux tickets et commentaires des posts)
// =====================================================================

// Type de fil : réponses d'un ticket ou commentaires d'un post
export type ThreadKind = "tickets" | "posts";

// Message publié dans un fil de discussion
export interface ThreadMessage {
  id: string;
  parentId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

// Longueur maximale d'un message (Markdown, blocs de code inclus)
export const MAX_THREAD_MESSAGE_LENGTH = 5000;
