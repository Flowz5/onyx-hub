import React from "react";
import type { Channel } from "../types/channel";
import "./ChannelRow.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { ChevronRight } from "lucide-react";

// Propriétés attendues pour l'affichage d'une ligne de canal
interface ChannelRowProps {
  channel: Channel;
  currentUserId?: string;
  currentUserEmail?: string;
  onSelectChannel: (channelId: string) => void;
  onDeleteChannel?: (channelId: string) => void;
}

// Composant représentant un canal sous forme de ligne horizontale interactive
export const ChannelRow: React.FC<ChannelRowProps> = ({
  channel,
  currentUserId,
  currentUserEmail,
  onSelectChannel,
  onDeleteChannel,
}) => {
  // Vérification de la propriété du canal par l'utilisateur connecté
  const isOwner =
    (currentUserId && channel.creatorId === currentUserId) ||
    (currentUserEmail && channel.createdBy === currentUserEmail);

  // Gestionnaire de suppression sans déclencher la navigation vers le canal
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteChannel) {
      const confirmDelete = window.confirm(
        `Êtes-vous sûr de vouloir supprimer le canal #${channel.name} ? Cette action est irréversible.`
      );
      if (confirmDelete) {
        onDeleteChannel(channel.id);
      }
    }
  };

  return (
    <article
      className="channel-row-item"
      onClick={() => onSelectChannel(channel.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectChannel(channel.id);
        }
      }}
    >
      {/* Informations principales du canal (gauche) */}
      <div className="channel-row-main">
        <div className="channel-title-line">
          <span className="channel-hash">#</span>
          <h4 className="channel-name">{channel.name}</h4>
          <span className={`channel-visibility-pill ${channel.visibility}`}>
            {channel.visibility === "private" ? "Privé" : "Public"}
          </span>
        </div>
        <p className="channel-description-text">
          {channel.description || "Aucune description fournie pour ce canal."}
        </p>
      </div>

      {/* Badges des thématiques et tags (centre) */}
      <div className="channel-row-tags">
        {channel.tags.map((tag) => (
          <span key={tag} className="channel-mini-tag">
            #{tag}
          </span>
        ))}
      </div>

      {/* Métadonnées et actions (droite) */}
      <div className="channel-row-actions">
        <div className="channel-meta-info">
          <span className="channel-author">
            {isOwner ? "Créé par vous" : `Par ${channel.createdBy || "Étudiant"}`}
          </span>
          <span className="channel-stats-preview">
            {channel.ticketsCount} tickets • {channel.postsCount} posts
          </span>
        </div>

        {/* Bouton de suppression réservé au créateur du canal */}
        {isOwner && onDeleteChannel && (
          <button
            type="button"
            className="delete-channel-btn"
            onClick={handleDeleteClick}
            title="Supprimer ce canal"
            aria-label="Supprimer ce canal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        )}

        {/* Indicateur de navigation vers la page du canal */}
        <span className="enter-channel-chevron" aria-hidden="true">
          <ChevronRight className="onyx-icon" size={20} strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
    </article>
  );
};
