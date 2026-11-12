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
}

// Données du formulaire de création d'un ticket
export interface NewTicketFormData {
  title: string;
  description: string;
  priority: TicketPriority;
  tags: string[];
}
