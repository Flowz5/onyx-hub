// =====================================================================
// DÉFINITION DES TYPES DU CENTRE DE NOTIFICATIONS
// =====================================================================

// Catégories de notifications, chacune activable dans les paramètres
export type NotificationCategory = "newPosts" | "ticketReplies" | "postComments" | "mentions";

// Préférences de notification d'un utilisateur
export type NotificationPreferences = Record<NotificationCategory, boolean>;

// Toutes les catégories sont actives par défaut
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  newPosts: true,
  ticketReplies: true,
  postComments: true,
  mentions: true,
};

// Document notificationSettings/{uid} : préférences et état de lecture des nouveaux posts
export interface NotificationSettings {
  preferences: NotificationPreferences;
  // Les nouveaux posts publiés avant cette date sont considérés comme lus
  postsReadAt: string;
  // Nouveaux posts lus individuellement après postsReadAt
  readPostIds: string[];
  // Les nouveaux posts publiés avant cette date ont été effacés de la liste (null si jamais vidée)
  clearedAt: string | null;
}

// Nombre maximal d'identifiants de posts lus conservés individuellement
export const MAX_READ_POST_IDS = 50;

// Type d'une notification écrite par l'auteur d'un message (document notifications/{id}),
// ou par un modérateur pour un avertissement visant un post, un ticket ou un message de leur fil
export type ThreadNotificationType =
  | "ticket_reply"
  | "post_comment"
  | "post_mention"
  | "ticket_mention"
  | "post_warning"
  | "ticket_warning";

// Catégorie affichée : les avertissements de modération ne sont pas désactivables
export type NotificationDisplayCategory = NotificationCategory | "warnings";

// Longueur maximale du motif d'un avertissement (identique à firestore.rules)
export const MAX_WARNING_REASON_LENGTH = 300;

// Élément affiché dans le centre de notifications
export interface NotificationItem {
  // Identifiant unique dans la liste (préfixé par la source)
  key: string;
  source: "thread" | "post";
  // Identifiant du document source : notification Firestore ou post
  sourceId: string;
  category: NotificationDisplayCategory;
  actorName: string;
  // Titre du post ou du ticket concerné
  title: string;
  channelId: string;
  // Nom du canal, lorsqu'il est connu
  channelName?: string;
  // Post ou ticket à mettre en avant à l'ouverture du canal
  targetId: string;
  targetTab: "posts" | "tickets";
  // Ouverture du fil de réponses ou de commentaires de la carte ciblée
  openThread: boolean;
  createdAt: string;
  isRead: boolean;
  // Motif d'un avertissement de modération
  reason?: string;
}

// État de navigation transmis à la page d'un canal à l'ouverture d'une notification
export interface NotificationFocus {
  targetId: string;
  tab: "posts" | "tickets";
  // Ouverture du fil de réponses ou de commentaires de la carte ciblée
  openThread: boolean;
  // Notification Firestore à l'origine de la navigation, supprimée si sa cible n'existe plus
  notificationId?: string;
}
