import React, { useEffect, useMemo, useState } from "react";
import "./TicketReplies.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { BadgeCheck, CircleAlert, CircleCheckBig, Send, Trash2, Undo2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { MAX_REPLY_LENGTH, type TicketReply } from "../types/ticket";
import {
  addTicketReply,
  deleteTicketReply,
  setTicketSolution,
  subscribeToTicketReplies,
} from "../services/ticketService";

interface TicketRepliesProps {
  ticketId: string;
  // Auteur du ticket, mis en évidence dans le fil de réponses
  ticketAuthorId: string;
  isResolved: boolean;
  // Réponse retenue comme solution (null si aucune)
  solutionReplyId: string | null;
}

// Fil de réponses d'un ticket d'aide avec formulaire de réponse
export const TicketReplies: React.FC<TicketRepliesProps> = ({
  ticketId,
  ticketAuthorId,
  isResolved,
  solutionReplyId,
}) => {
  const { user } = useAuth();
  // Seul l'auteur du ticket peut désigner la solution
  const canChooseSolution = user?.uid === ticketAuthorId;

  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Écoute en temps réel des réponses, active uniquement lorsque le fil est affiché
  useEffect(() => {
    const unsubscribe = subscribeToTicketReplies(
      ticketId,
      (loadedReplies) => {
        setReplies(loadedReplies);
        setIsLoading(false);
      },
      () => {
        setErrorMessage("Impossible de charger les réponses de ce ticket.");
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [ticketId]);

  // Envoi d'une nouvelle réponse
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = draft.trim();
    if (!user || !content || isSending) return;

    setIsSending(true);
    setErrorMessage(null);
    try {
      await addTicketReply(ticketId, content, user);
      setDraft("");
    } catch (error) {
      console.error("Erreur lors de l'envoi de la réponse :", error);
      setErrorMessage("L'envoi de la réponse a échoué. Réessayez dans un instant.");
    } finally {
      setIsSending(false);
    }
  };

  // Réponses ordonnées : la solution est épinglée en tête du fil
  const orderedReplies = useMemo(() => {
    const solution = replies.find((reply) => reply.id === solutionReplyId);
    if (!solution) return replies;
    return [solution, ...replies.filter((reply) => reply.id !== solutionReplyId)];
  }, [replies, solutionReplyId]);

  // Désignation ou retrait de la solution par l'auteur du ticket
  const handleToggleSolution = async (replyId: string) => {
    const nextSolution = replyId === solutionReplyId ? null : replyId;
    try {
      await setTicketSolution(ticketId, nextSolution);
    } catch (error) {
      console.error("Erreur lors du marquage de la solution :", error);
      setErrorMessage("Impossible de mettre à jour la solution de ce ticket.");
    }
  };

  // Suppression d'une réponse par son auteur, après confirmation
  const handleDelete = async (replyId: string) => {
    if (!window.confirm("Voulez-vous supprimer cette réponse ?")) return;
    try {
      await deleteTicketReply(ticketId, replyId);
    } catch (error) {
      console.error("Erreur lors de la suppression de la réponse :", error);
      setErrorMessage("Impossible de supprimer cette réponse.");
    }
  };

  // Formatage de la date en français
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <section className="ticket-replies-component" aria-label="Réponses au ticket">
      {/* Fil des réponses */}
      {isLoading ? (
        <p className="replies-status-text">Chargement des réponses...</p>
      ) : replies.length === 0 ? (
        <p className="replies-status-text">
          Aucune réponse pour l'instant. Soyez le premier à proposer votre aide !
        </p>
      ) : (
        <ul className="replies-list">
          {orderedReplies.map((reply) => {
            const isTicketAuthor = reply.authorId === ticketAuthorId;
            const isMine = user?.uid === reply.authorId;
            const isSolution = reply.id === solutionReplyId;
            return (
              <li
                key={reply.id}
                className={`reply-item ${isTicketAuthor ? "from-author" : ""} ${isSolution ? "is-solution" : ""}`}
              >
                {/* Bandeau de la réponse retenue comme solution */}
                {isSolution && (
                  <span className="solution-banner">
                    <CircleCheckBig className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
                    Solution retenue par l'auteur
                  </span>
                )}
                <div className="reply-meta">
                  <strong className="reply-author">{reply.authorName}</strong>
                  {isTicketAuthor && (
                    <span className="author-badge">
                      <BadgeCheck className="onyx-icon onyx-icon--leading" size={12} strokeWidth={2} aria-hidden="true" />
                      Auteur du ticket
                    </span>
                  )}
                  <span className="reply-date">{formatDate(reply.createdAt)}</span>

                  {/* Suppression réservée à l'auteur de la réponse */}
                  {isMine && (
                    <button
                      type="button"
                      className="delete-reply-btn"
                      onClick={() => handleDelete(reply.id)}
                      title="Supprimer ma réponse"
                      aria-label="Supprimer ma réponse"
                    >
                      <Trash2 className="onyx-icon" size={13} strokeWidth={2} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <p className="reply-content">{reply.content}</p>

                {/* Action de l'auteur du ticket : marquer ou retirer la solution */}
                {canChooseSolution && (
                  <button
                    type="button"
                    className={`solution-toggle-btn ${isSolution ? "active" : ""}`}
                    onClick={() => handleToggleSolution(reply.id)}
                  >
                    {isSolution ? (
                      <>
                        <Undo2 className="onyx-icon onyx-icon--leading" size={13} strokeWidth={2} aria-hidden="true" />
                        Retirer la solution
                      </>
                    ) : (
                      <>
                        <CircleCheckBig className="onyx-icon onyx-icon--leading" size={13} strokeWidth={2} aria-hidden="true" />
                        Marquer comme solution
                      </>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {errorMessage && (
        <p className="replies-error" role="alert">
          <CircleAlert className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
          {errorMessage}
        </p>
      )}

      {/* Formulaire de réponse */}
      <form className="reply-form" onSubmit={handleSubmit}>
        {isResolved && (
          <p className="resolved-hint">
            Ce ticket est marqué comme résolu, vous pouvez tout de même compléter la réponse.
          </p>
        )}
        <textarea
          className="reply-textarea"
          rows={3}
          maxLength={MAX_REPLY_LENGTH}
          placeholder="Proposez une piste, une explication ou une solution..."
          value={draft}
          disabled={isSending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Raccourci Ctrl/Cmd + Entrée pour envoyer la réponse
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          aria-label="Votre réponse au ticket"
        />
        <div className="reply-form-footer">
          <span className="reply-hint">
            {draft.length}/{MAX_REPLY_LENGTH} · Ctrl + Entrée pour envoyer
          </span>
          <button type="submit" className="send-reply-btn" disabled={isSending || !draft.trim()}>
            <Send className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
            {isSending ? "Envoi..." : "Répondre"}
          </button>
        </div>
      </form>
    </section>
  );
};
