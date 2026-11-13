// =====================================================================
// HOOK DU CENTRE DE NOTIFICATIONS
// Fusionne les notifications de fil (réponses, commentaires) et les nouveaux posts
// des canaux accessibles, filtrés selon les préférences de l'utilisateur.
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeToChannels } from "../services/channelService";
import {
  clearAllNotifications,
  markAllPostNotificationsRead,
  markPostNotificationRead,
  markThreadNotificationsRead,
  saveNotificationPreferences,
  subscribeToNotificationSettings,
  subscribeToRecentChannelPosts,
  subscribeToThreadNotifications,
  type RecentPost,
  type ThreadNotification,
} from "../services/notificationService";
import type { Channel } from "../types/channel";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationDisplayCategory,
  type NotificationItem,
  type NotificationPreferences,
  type NotificationSettings,
} from "../types/notification";

// Fenêtre d'affichage des nouveaux posts et nombre maximal d'éléments listés
const NEW_POSTS_WINDOW_DAYS = 14;
const MAX_DISPLAYED_NOTIFICATIONS = 40;

export const useNotifications = (user: User | null) => {
  const userId = user?.uid ?? null;
  const userEmail = user?.email ?? null;

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [threadNotifications, setThreadNotifications] = useState<ThreadNotification[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [recentPostsByChannel, setRecentPostsByChannel] = useState<Record<string, RecentPost[]>>({});

  // Horloge rafraîchie chaque minute pour la fenêtre des nouveaux posts
  const [now, setNow] = useState(() => Date.now());

  const preferences = settings?.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
  const wantsNewPosts = preferences.newPosts;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  // Paramètres de l'utilisateur (créés à la première connexion)
  useEffect(() => {
    if (!userId) return;
    return subscribeToNotificationSettings(userId, setSettings);
  }, [userId]);

  // Notifications de réponses et de commentaires
  useEffect(() => {
    if (!userId) return;
    return subscribeToThreadNotifications(userId, setThreadNotifications);
  }, [userId]);

  // Canaux accessibles, uniquement si les nouveaux posts sont suivis
  useEffect(() => {
    if (!userId || !wantsNewPosts) return;
    return subscribeToChannels({ uid: userId, email: userEmail }, setChannels);
  }, [userId, userEmail, wantsNewPosts]);

  const followedChannels = useMemo(() => (wantsNewPosts ? channels : []), [wantsNewPosts, channels]);

  // Derniers posts de chaque canal (clé stable pour ne pas relancer les écoutes à chaque mise à jour)
  const channelIdsKey = useMemo(
    () => followedChannels.map((channel) => channel.id).sort().join(","),
    [followedChannels]
  );

  useEffect(() => {
    const channelIds = channelIdsKey ? channelIdsKey.split(",") : [];
    const unsubscribers = channelIds.map((channelId) =>
      subscribeToRecentChannelPosts(channelId, (posts) =>
        setRecentPostsByChannel((previous) => ({ ...previous, [channelId]: posts }))
      )
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [channelIdsKey]);

  // Liste fusionnée, triée de la plus récente à la plus ancienne
  const notifications = useMemo<NotificationItem[]>(() => {
    if (!settings) return [];
    const channelNames = new Map(followedChannels.map((channel) => [channel.id, channel.name]));
    const items: NotificationItem[] = [];

    threadNotifications.forEach((notification) => {
      const isWarning =
        notification.type === "post_warning" || notification.type === "ticket_warning";
      const category: NotificationDisplayCategory = isWarning
        ? "warnings"
        : notification.type === "ticket_reply"
          ? "ticketReplies"
          : notification.type === "post_comment"
            ? "postComments"
            : "mentions";
      // Les avertissements de modération sont toujours affichés
      if (category !== "warnings" && !preferences[category]) return;
      const isTicket =
        notification.type === "ticket_reply" ||
        notification.type === "ticket_mention" ||
        notification.type === "ticket_warning";
      items.push({
        key: `thread-${notification.id}`,
        source: "thread",
        sourceId: notification.id,
        category,
        actorName: notification.actorName,
        title: notification.parentTitle,
        channelId: notification.channelId,
        channelName: channelNames.get(notification.channelId),
        targetId: notification.parentId,
        targetTab: isTicket ? "tickets" : "posts",
        // Fil ouvert pour une réponse, un commentaire ou une mention dans l'un d'eux
        openThread: notification.messageId !== null,
        createdAt: notification.createdAt,
        isRead: notification.read,
        reason: notification.reason,
      });
    });

    if (preferences.newPosts) {
      const windowStart = now - NEW_POSTS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const readAt = new Date(settings.postsReadAt).getTime();
      const clearedAt = settings.clearedAt ? new Date(settings.clearedAt).getTime() : 0;
      // Seuls les canaux encore suivis sont pris en compte (accès retiré, canal supprimé)
      followedChannels
        .flatMap((channel) => recentPostsByChannel[channel.id] ?? [])
        .forEach((post) => {
          const createdAt = new Date(post.createdAt).getTime();
          // Ses propres posts, les posts anciens et ceux déjà effacés ne sont pas notifiés
          if (post.authorId === userId || createdAt < windowStart || createdAt <= clearedAt) return;
          items.push({
            key: `post-${post.id}`,
            source: "post",
            sourceId: post.id,
            category: "newPosts",
            actorName: post.authorName,
            title: post.title,
            channelId: post.channelId,
            channelName: channelNames.get(post.channelId),
            targetId: post.id,
            targetTab: "posts",
            openThread: false,
            createdAt: post.createdAt,
            isRead: createdAt <= readAt || settings.readPostIds.includes(post.id),
          });
        });
    }

    return items
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_DISPLAYED_NOTIFICATIONS);
  }, [settings, preferences, threadNotifications, recentPostsByChannel, followedChannels, userId, now]);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  // Marquage d'une notification comme lue
  const markAsRead = useCallback(
    async (item: NotificationItem) => {
      if (!userId || item.isRead) return;
      if (item.source === "thread") {
        await markThreadNotificationsRead([item.sourceId]);
      } else {
        await markPostNotificationRead(userId, item.sourceId);
      }
    },
    [userId]
  );

  // Marquage de l'ensemble des notifications comme lues
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const unreadThreadIds = threadNotifications
      .filter((notification) => !notification.read)
      .map((notification) => notification.id);
    await Promise.all([
      markThreadNotificationsRead(unreadThreadIds),
      markAllPostNotificationsRead(userId),
    ]);
  }, [userId, threadNotifications]);

  // Effacement de toutes les notifications
  const clearAll = useCallback(async () => {
    if (!userId) return;
    await clearAllNotifications(userId);
  }, [userId]);

  // Enregistrement des préférences
  const updatePreferences = useCallback(
    async (nextPreferences: NotificationPreferences) => {
      if (!userId) return;
      await saveNotificationPreferences(userId, nextPreferences);
    },
    [userId]
  );

  return {
    isReady: settings !== null,
    notifications,
    unreadCount,
    preferences,
    markAsRead,
    markAllAsRead,
    clearAll,
    updatePreferences,
  };
};
