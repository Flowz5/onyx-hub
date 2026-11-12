// =====================================================================
// DÉFINITION DES TYPES ET INTERFACES LIÉS AUX POSTS D'UN CANAL
// =====================================================================

// Structure complète d'un post au sein d'un canal
export interface Post {
  id: string;
  channelId: string;
  title: string;
  content: string;
  tags: string[];
  authorId: string;
  authorName: string;
  createdAt: string;
  upvotesCount: number;
  upvotedBy: string[];
  commentsCount: number;
}

// Données du formulaire de création d'un nouveau post
export interface NewPostFormData {
  title: string;
  content: string;
  tags: string[];
}

// Longueur maximale du contenu d'un post (Markdown, blocs de code inclus)
export const MAX_POST_CONTENT_LENGTH = 10000;
