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
}

// Données requises issues du formulaire de création d'un canal
export interface NewChannelFormData {
  name: string;
  description: string;
  tags: string[];
  visibility: "public" | "private";
}
