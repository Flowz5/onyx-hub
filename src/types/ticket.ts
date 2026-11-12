// =====================================================================
// DÉFINITION DES TYPES ET INTERFACES LIÉS AUX TICKETS D'AIDE
// =====================================================================

export type TicketStatus = "open" | "in_progress" | "resolved";
export type TicketPriority = "low" | "medium" | "high";

// Structure complète d'un ticket d'assistance technique ou de cours
export interface Ticket {
  id: string;
  channelId: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  tags: string[];
  authorId: string;
  authorName: string;
  createdAt: string;
  repliesCount: number;
  // Identifiant de la réponse retenue comme solution par l'auteur (null si aucune)
  solutionReplyId: string | null;
}

// Données du formulaire de création d'un ticket
export interface NewTicketFormData {
  title: string;
  description: string;
  priority: TicketPriority;
  tags: string[];
}

// Réponse apportée par un membre du canal à un ticket d'aide
export interface TicketReply {
  id: string;
  ticketId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

// Longueur maximale d'une réponse à un ticket
export const MAX_REPLY_LENGTH = 3000;
