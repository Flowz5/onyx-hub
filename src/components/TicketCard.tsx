import React from "react";
import type { Ticket, TicketStatus } from "../types/ticket";
import "./TicketCard.scss";

interface TicketCardProps {
  ticket: Ticket;
  currentUserId?: string;
  onUpdateStatus?: (ticketId: string, newStatus: TicketStatus) => void;
  onDelete?: (ticketId: string) => void;
}

// Libellés conviviaux pour les statuts
const STATUS_LABELS: Record<TicketStatus, { label: string }> = {
  open: { label: "Ouvert" },
  in_progress: { label: "En cours" },
  resolved: { label: "Résolu" },
};

// Libellés conviviaux pour les priorités
const PRIORITY_LABELS: Record<string, { label: string; class: string }> = {
  low: { label: "Faible", class: "low" },
  medium: { label: "Normale", class: "medium" },
  high: { label: "Urgente", class: "high" },
};

// Composant représentant un ticket d'aide
export const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  currentUserId,
  onUpdateStatus,
  onDelete,
}) => {
  const isAuthor = currentUserId && ticket.authorId === currentUserId;

  const formattedDate = new Date(ticket.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      const confirmDelete = window.confirm(
        `Voulez-vous supprimer ce ticket d'aide "${ticket.title}" ?`
      );
      if (confirmDelete) {
        onDelete(ticket.id);
      }
    }
  };

  return (
    <article className={`ticket-card-item status-${ticket.status}`}>
      {/* En-tête du ticket avec statut et priorité */}
      <div className="ticket-card-header">
        <div className="status-priority-badges">
          {/* Badge de statut */}
          <span className={`status-badge ${ticket.status}`}>
            <span className="dot" />
            {STATUS_LABELS[ticket.status]?.label || ticket.status}
          </span>

          {/* Badge de priorité */}
          <span className={`priority-badge ${PRIORITY_LABELS[ticket.priority]?.class || "medium"}`}>
            Priorité : {PRIORITY_LABELS[ticket.priority]?.label || ticket.priority}
          </span>
        </div>

        {/* Métadonnées auteur et date */}
        <div className="ticket-author-info">
          <span>Par <strong>{ticket.authorName}</strong></span>
          <span className="meta-separator">•</span>
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Titre du ticket */}
      <h3 className="ticket-title">{ticket.title}</h3>

      {/* Description du problème rencontré */}
      <p className="ticket-description">{ticket.description}</p>

      {/* Thématiques et Tags associés */}
      {ticket.tags.length > 0 && (
        <div className="ticket-tags-row">
          {ticket.tags.map((tag) => (
            <span key={tag} className="ticket-tag-chip">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Pied de carte avec mise à jour du statut et options */}
      <div className="ticket-card-footer">
        {/* Sélecteur de mise à jour d'état */}
        <div className="status-selector-wrapper">
          <label htmlFor={`ticket-status-${ticket.id}`} className="status-selector-label">
            Statut :
          </label>
          <select
            id={`ticket-status-${ticket.id}`}
            className="status-dropdown"
            value={ticket.status}
            onChange={(e) => {
              if (onUpdateStatus) {
                onUpdateStatus(ticket.id, e.target.value as TicketStatus);
              }
            }}
          >
            <option value="open">Ouvert</option>
            <option value="in_progress">En cours</option>
            <option value="resolved">Résolu</option>
          </select>
        </div>

        {/* Bouton de suppression réservé à l'auteur */}
        {isAuthor && onDelete && (
          <button
            type="button"
            className="delete-ticket-btn"
            onClick={handleDeleteClick}
            title="Supprimer mon ticket"
          >
            Supprimer le ticket
          </button>
        )}
      </div>
    </article>
  );
};
