import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./NotificationCenter.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCheck,
  MessageSquare,
  MessageSquareReply,
  Newspaper,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import type {
  NotificationCategory,
  NotificationFocus,
  NotificationItem,
  NotificationPreferences,
} from "../types/notification";

// Libellés et descriptions des catégories affichées dans les paramètres
const CATEGORY_OPTIONS: { category: NotificationCategory; label: string; description: string }[] = [
  {
    category: "newPosts",
    label: "Nouveaux posts",
    description: "Publications des autres membres dans mes canaux",
  },
  {
    category: "ticketReplies",
    label: "Réponses à mes tickets",
    description: "Quelqu'un propose de l'aide sur un de mes tickets",
  },
  {
    category: "postComments",
    label: "Commentaires sur mes posts",
    description: "Quelqu'un réagit à une de mes publications",
  },
];

// Icône associée à chaque catégorie
const CATEGORY_ICONS: Record<NotificationCategory, typeof Bell> = {
  newPosts: Newspaper,
  ticketReplies: MessageSquareReply,
  postComments: MessageSquare,
};

// Phrase décrivant l'action à l'origine de la notification
const ACTION_LABELS: Record<NotificationCategory, string> = {
  newPosts: "a publié",
  ticketReplies: "a répondu à votre ticket",
  postComments: "a commenté votre post",
};

// Date relative en français (« il y a 5 minutes »)
const relativeTimeFormatter = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
const formatRelativeDate = (isoDate: string): string => {
  const seconds = Math.round((new Date(isoDate).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, unitSeconds] of units) {
    if (Math.abs(seconds) >= unitSeconds) {
      return relativeTimeFormatter.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return "à l'instant";
};

// Cloche de la barre de navigation et fenêtre des notifications (liste et paramètres)
export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    isReady,
    notifications,
    unreadCount,
    preferences,
    markAsRead,
    markAllAsRead,
    clearAll,
    updatePreferences,
  } = useNotifications(user);

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"list" | "settings">("list");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur et via la touche Échap
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const togglePanel = () => {
    setIsOpen((open) => !open);
    setView("list");
    setErrorMessage(null);
  };

  // Ouverture d'une notification : marquage comme lue puis navigation vers la carte ciblée
  const handleOpenNotification = (item: NotificationItem) => {
    markAsRead(item).catch((error) =>
      console.error("Erreur lors du marquage de la notification :", error)
    );
    const notificationFocus: NotificationFocus = {
      targetId: item.targetId,
      tab: item.targetTab,
      openThread: item.category !== "newPosts",
    };
    setIsOpen(false);
    navigate(`/channels/${item.channelId}`, { state: { notificationFocus } });
  };

  const handleMarkAllAsRead = async () => {
    setErrorMessage(null);
    try {
      await markAllAsRead();
    } catch (error) {
      console.error("Erreur lors du marquage des notifications :", error);
      setErrorMessage("Impossible de marquer les notifications comme lues.");
    }
  };

  // Effacement de toutes les notifications, après confirmation
  const handleClearAll = async () => {
    if (!window.confirm("Effacer toutes vos notifications ?")) return;
    setErrorMessage(null);
    try {
      await clearAll();
    } catch (error) {
      console.error("Erreur lors de l'effacement des notifications :", error);
      setErrorMessage("Impossible d'effacer les notifications. Réessayez dans un instant.");
    }
  };

  // Bascule d'une catégorie, enregistrée immédiatement
  const handleTogglePreference = async (category: NotificationCategory) => {
    const nextPreferences: NotificationPreferences = {
      ...preferences,
      [category]: !preferences[category],
    };
    setErrorMessage(null);
    try {
      await updatePreferences(nextPreferences);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des préférences :", error);
      setErrorMessage("L'enregistrement des préférences a échoué. Réessayez dans un instant.");
    }
  };

  const allDisabled = CATEGORY_OPTIONS.every(({ category }) => !preferences[category]);

  return (
    <div className="notification-center" ref={containerRef}>
      {/* Bouton cloche avec pastille du nombre de notifications non lues */}
      <button
        type="button"
        className={`notification-bell-btn ${isOpen ? "active" : ""}`}
        onClick={togglePanel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={
          unreadCount > 0 ? `Notifications (${unreadCount} non lues)` : "Notifications"
        }
        title="Notifications"
      >
        <Bell className="onyx-icon" size={18} strokeWidth={2} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div
          className="notification-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="notification-panel-title"
        >
          {/* En-tête : titre, actions et fermeture */}
          <div className="notification-panel-header">
            {view === "settings" && (
              <button
                type="button"
                className="panel-icon-btn"
                onClick={() => setView("list")}
                aria-label="Retour aux notifications"
                title="Retour"
              >
                <ArrowLeft className="onyx-icon" size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
            <h2 id="notification-panel-title">
              {view === "list" ? "Notifications" : "Paramètres"}
            </h2>
            <div className="panel-header-actions">
              {view === "list" && (
                <>
                  <button
                    type="button"
                    className="panel-icon-btn"
                    onClick={handleMarkAllAsRead}
                    disabled={unreadCount === 0}
                    aria-label="Tout marquer comme lu"
                    title="Tout marquer comme lu"
                  >
                    <CheckCheck className="onyx-icon" size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="panel-icon-btn danger"
                    onClick={handleClearAll}
                    disabled={notifications.length === 0}
                    aria-label="Effacer toutes les notifications"
                    title="Tout effacer"
                  >
                    <Trash2 className="onyx-icon" size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="panel-icon-btn"
                    onClick={() => {
                      setView("settings");
                      setErrorMessage(null);
                    }}
                    aria-label="Paramètres des notifications"
                    title="Paramètres"
                  >
                    <Settings className="onyx-icon" size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                </>
              )}
              <button
                type="button"
                className="panel-icon-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Fermer les notifications"
                title="Fermer"
              >
                <X className="onyx-icon" size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="notification-error" role="alert">
              {errorMessage}
            </div>
          )}

          {/* Vue liste */}
          {view === "list" && (
            <div className="notification-list">
              {!isReady ? (
                <p className="notification-empty">Chargement...</p>
              ) : allDisabled ? (
                <div className="notification-empty">
                  <BellOff className="onyx-icon" size={28} strokeWidth={2} aria-hidden="true" />
                  <p>Toutes les notifications sont désactivées.</p>
                  <button type="button" className="empty-link-btn" onClick={() => setView("settings")}>
                    Modifier les paramètres
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="notification-empty">
                  <Bell className="onyx-icon" size={28} strokeWidth={2} aria-hidden="true" />
                  <p>Aucune notification pour l'instant.</p>
                </div>
              ) : (
                <ul>
                  {notifications.map((item) => {
                    const Icon = CATEGORY_ICONS[item.category];
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          className={`notification-item ${item.isRead ? "" : "unread"}`}
                          onClick={() => handleOpenNotification(item)}
                        >
                          <span className={`notification-icon ${item.category}`}>
                            <Icon className="onyx-icon" size={16} strokeWidth={2} aria-hidden="true" />
                          </span>
                          <span className="notification-text">
                            <span className="notification-message">
                              <strong>{item.actorName}</strong> {ACTION_LABELS[item.category]}{" "}
                              <em>« {item.title} »</em>
                            </span>
                            <span className="notification-meta">
                              {item.channelName && <>#{item.channelName} · </>}
                              {formatRelativeDate(item.createdAt)}
                            </span>
                          </span>
                          {!item.isRead && <span className="unread-dot" aria-label="Non lue" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Vue paramètres : choix des catégories notifiées */}
          {view === "settings" && (
            <div className="notification-settings">
              <p className="settings-intro">Choisissez les notifications que vous souhaitez recevoir.</p>
              {CATEGORY_OPTIONS.map(({ category, label, description }) => {
                const Icon = CATEGORY_ICONS[category];
                return (
                  <label key={category} className="settings-row">
                    <span className={`notification-icon ${category}`}>
                      <Icon className="onyx-icon" size={16} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="settings-text">
                      <span className="settings-label">{label}</span>
                      <span className="settings-description">{description}</span>
                    </span>
                    <input
                      type="checkbox"
                      className="settings-switch"
                      role="switch"
                      checked={preferences[category]}
                      onChange={() => handleTogglePreference(category)}
                      disabled={!isReady}
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
