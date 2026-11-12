import React, { useEffect, useRef, useState } from "react";
import type { Ticket, TicketStatus } from "../types/ticket";
import "./TicketCard.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { ChevronDown, MessageSquareReply, Pencil, Trash2 } from "lucide-react";
import { DiscussionThread } from "./DiscussionThread";
import { RichContent } from "./RichContent";

interface TicketCardProps {
  ticket: Ticket;
  currentUserId?: string;
  onUpdateStatus?: (ticketId: string, newStatus: TicketStatus) => void;
  onDelete?: (ticketId: string) => void;
  // Ouverture de la modale d'édition (auteur uniquement)
  onEdit?: (ticket: Ticket) => void;
  // Mise en avant depuis une notification : la carte défile à l'écran, avec son fil ouvert si besoin
  focus?: "card" | "thread" | null;
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
  onEdit,
  focus = null,
}) => {
  const isAuthor = currentUserId && ticket.authorId === currentUserId;
  // Affichage du fil de réponses (chargé uniquement à l'ouverture)
  const [areRepliesOpen, setAreRepliesOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  // Arrivée depuis une notification : ouverture du fil puis défilement jusqu'à la carte
  useEffect(() => {
    if (!focus) return;
    if (focus === "thread") setAreRepliesOpen(true);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

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
    <article
      ref={cardRef}
      className={`ticket-card-item status-${ticket.status} ${focus ? "is-focused" : ""}`}
    >
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
      <RichContent className="ticket-description" content={ticket.description} />

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

      {/* Pied de carte : accès aux réponses pour tous, contrôles réservés à l'auteur */}
      <div className="ticket-card-footer">
        <button
          type="button"
          className={`toggle-replies-btn ${areRepliesOpen ? "open" : ""}`}
          onClick={() => setAreRepliesOpen((isOpen) => !isOpen)}
          aria-expanded={areRepliesOpen}
        >
          <MessageSquareReply className="onyx-icon onyx-icon--leading" size={15} strokeWidth={2} aria-hidden="true" />
          {ticket.repliesCount > 0
            ? `${ticket.repliesCount} réponse${ticket.repliesCount > 1 ? "s" : ""}`
            : "Répondre"}
          {/* Indication d'une solution retenue */}
          {ticket.solutionReplyId && <span className="solution-flag">· Solution trouvée</span>}
          <ChevronDown className="onyx-icon chevron" size={14} strokeWidth={2} aria-hidden="true" />
        </button>

        {isAuthor && (
          <div className="author-controls">
            {/* Sélecteur de mise à jour d'état, réservé à l'auteur du ticket */}
            {onUpdateStatus && (
              <div className="status-selector-wrapper">
                <label htmlFor={`ticket-status-${ticket.id}`} className="status-selector-label">
                  Statut :
                </label>
                <select
                  id={`ticket-status-${ticket.id}`}
                  className="status-dropdown"
                  value={ticket.status}
                  onChange={(e) => onUpdateStatus(ticket.id, e.target.value as TicketStatus)}
                >
                  <option value="open">Ouvert</option>
                  <option value="in_progress">En cours</option>
                  <option value="resolved">Résolu</option>
                </select>
              </div>
            )}

            {/* Actions de l'auteur : modification et suppression */}
            {(onEdit || onDelete) && (
              <div className="author-actions">
                {onEdit && (
                  <button
                    type="button"
                    className="edit-ticket-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(ticket);
                    }}
                    title="Modifier mon ticket"
                    aria-label="Modifier mon ticket"
                  >
                    <Pencil className="onyx-icon" size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className="delete-ticket-btn"
                    onClick={handleDeleteClick}
                    title="Supprimer mon ticket"
                    aria-label="Supprimer mon ticket"
                  >
                    <Trash2 className="onyx-icon" size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fil de réponses déplié */}
      {areRepliesOpen && (
        <DiscussionThread
          kind="tickets"
          parentId={ticket.id}
          parentAuthorId={ticket.authorId}
          parentTitle={ticket.title}
          channelId={ticket.channelId}
          isResolved={ticket.status === "resolved"}
          solutionMessageId={ticket.solutionReplyId}
        />
      )}
    </article>
  );
};
