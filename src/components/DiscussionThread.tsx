import React, { useEffect, useMemo, useState } from "react";
import "./DiscussionThread.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { ArrowBigUp, BadgeCheck, CircleAlert, CircleCheckBig, Send, Trash2, Undo2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { RichContent } from "./RichContent";
import { AuthorLink } from "./UserAvatar";
import { useMentionCandidates } from "../context/MentionContext";
import { resolveMentionTargets } from "../types/mention";
import { RichTextEditor } from "./RichTextEditor";
import { MAX_THREAD_MESSAGE_LENGTH, type ThreadKind, type ThreadMessage } from "../types/thread";
import {
  addThreadMessage,
  deleteThreadMessage,
  subscribeToThreadMessages,
  toggleThreadMessageUpvote,
} from "../services/threadService";
import { setTicketSolution } from "../services/ticketService";

interface DiscussionThreadProps {
  // Type de fil : réponses d'un ticket ou commentaires d'un post
  kind: ThreadKind;
  parentId: string;
  // Auteur du ticket ou du post, mis en évidence dans le fil et notifié des nouveaux messages
  parentAuthorId: string;
  // Titre et canal du parent, repris dans la notification envoyée à son auteur
  parentTitle: string;
  channelId: string;
  // Options propres aux tickets : statut résolu et réponse retenue comme solution
  isResolved?: boolean;
  solutionMessageId?: string | null;
  // Auteur crédité de la solution actuelle (pour le décréditer en cas de changement)
  solutionAuthorId?: string | null;
}

// Libellés adaptés au type de fil
const LABELS: Record<
  ThreadKind,
  {
    noun: string;
    authorBadge: string;
    empty: string;
    placeholder: string;
    submit: string;
    ariaLabel: string;
    upvoteTitle: string;
  }
> = {
  tickets: {
    noun: "réponse",
    authorBadge: "Auteur du ticket",
    empty: "Aucune réponse pour l'instant. Soyez le premier à proposer votre aide !",
    placeholder: "Proposez une piste, une explication ou une solution (blocs de code bienvenus)...",
    submit: "Répondre",
    ariaLabel: "Réponses au ticket",
    upvoteTitle: "Cette réponse est utile",
  },
  posts: {
    noun: "commentaire",
    authorBadge: "Auteur du post",
    empty: "Aucun commentaire pour l'instant. Lancez la discussion !",
    placeholder: "Ajoutez un commentaire, un lien ou un extrait de code...",
    submit: "Commenter",
    ariaLabel: "Commentaires du post",
    upvoteTitle: "J'aime ce commentaire",
  },
};

// Fil de discussion générique : réponses d'un ticket ou commentaires d'un post
export const DiscussionThread: React.FC<DiscussionThreadProps> = ({
  kind,
  parentId,
  parentAuthorId,
  parentTitle,
  channelId,
  isResolved = false,
  solutionMessageId = null,
  solutionAuthorId = null,
}) => {
  const { user } = useAuth();
  const labels = LABELS[kind];
  const mentionCandidates = useMentionCandidates();
  // Seul l'auteur d'un ticket peut désigner la solution (sans objet pour les posts)
  const canChooseSolution = kind === "tickets" && user?.uid === parentAuthorId;

  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Écoute en temps réel des messages, active uniquement lorsque le fil est affiché
  useEffect(() => {
    const unsubscribe = subscribeToThreadMessages(
      kind,
      parentId,
      (loadedMessages) => {
        setMessages(loadedMessages);
        setIsLoading(false);
      },
      () => {
        setErrorMessage("Impossible de charger cette discussion.");
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [kind, parentId]);

  // Envoi d'un nouveau message
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = draft.trim();
    if (!user || !content || isSending) return;

    setIsSending(true);
    setErrorMessage(null);
    try {
      await addThreadMessage(
        kind,
        { id: parentId, authorId: parentAuthorId, title: parentTitle, channelId },
        content,
        user,
        resolveMentionTargets(content, mentionCandidates, [user.uid, parentAuthorId])
      );
      setDraft("");
    } catch (error) {
      console.error("Erreur lors de l'envoi du message :", error);
      setErrorMessage(`L'envoi du ${labels.noun} a échoué. Réessayez dans un instant.`);
    } finally {
      setIsSending(false);
    }
  };

  // Messages ordonnés : la solution éventuelle est épinglée en tête du fil,
  // puis les messages suivent par nombre de votes décroissant (puis par date)
  const orderedMessages = useMemo(() => {
    const others = messages
      .filter((message) => message.id !== solutionMessageId)
      .sort(
        (a, b) =>
          b.upvotesCount - a.upvotesCount ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    const solution = messages.find((message) => message.id === solutionMessageId);
    return solution ? [solution, ...others] : others;
  }, [messages, solutionMessageId]);

  // Vote positif sur le message d'un autre étudiant
  const handleToggleUpvote = async (message: ThreadMessage) => {
    if (!user || message.authorId === user.uid) return;
    try {
      await toggleThreadMessageUpvote(
        kind,
        parentId,
        message.id,
        user.uid,
        message.upvotedBy.includes(user.uid)
      );
    } catch (error) {
      console.error("Erreur lors du vote sur le message :", error);
      setErrorMessage("Impossible d'enregistrer votre vote. Réessayez dans un instant.");
    }
  };

  // Désignation ou retrait de la solution par l'auteur du ticket
  const handleToggleSolution = async (messageId: string) => {
    const nextMessage =
      messageId === solutionMessageId ? null : messages.find((message) => message.id === messageId);
    try {
      await setTicketSolution(
        parentId,
        nextMessage ? { id: nextMessage.id, authorId: nextMessage.authorId } : null,
        solutionAuthorId
      );
    } catch (error) {
      console.error("Erreur lors du marquage de la solution :", error);
      setErrorMessage("Impossible de mettre à jour la solution de ce ticket.");
    }
  };

  // Suppression d'un message par son auteur, après confirmation
  const handleDelete = async (message: ThreadMessage) => {
    if (!window.confirm(`Voulez-vous supprimer ce ${labels.noun} ?`)) return;
    try {
      await deleteThreadMessage(kind, parentId, message);
    } catch (error) {
      console.error("Erreur lors de la suppression du message :", error);
      setErrorMessage(`Impossible de supprimer ce ${labels.noun}.`);
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
    <section className="discussion-thread-component" aria-label={labels.ariaLabel}>
      {/* Liste des messages */}
      {isLoading ? (
        <p className="thread-status-text">Chargement de la discussion...</p>
      ) : messages.length === 0 ? (
        <p className="thread-status-text">{labels.empty}</p>
      ) : (
        <ul className="thread-messages-list">
          {orderedMessages.map((message) => {
            const isParentAuthor = message.authorId === parentAuthorId;
            const isMine = user?.uid === message.authorId;
            const isSolution = message.id === solutionMessageId;
            return (
              <li
                key={message.id}
                className={`thread-message ${isParentAuthor ? "from-author" : ""} ${isSolution ? "is-solution" : ""}`}
              >
                {/* Bandeau de la réponse retenue comme solution */}
                {isSolution && (
                  <span className="solution-banner">
                    <CircleCheckBig className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
                    Solution retenue par l'auteur
                  </span>
                )}
                <div className="message-meta">
                  <AuthorLink
                    uid={message.authorId}
                    fallbackName={message.authorName}
                    avatarSize={24}
                    className="message-author"
                  />
                  {isParentAuthor && (
                    <span className="author-badge">
                      <BadgeCheck className="onyx-icon onyx-icon--leading" size={12} strokeWidth={2} aria-hidden="true" />
                      {labels.authorBadge}
                    </span>
                  )}
                  <span className="message-date">{formatDate(message.createdAt)}</span>

                  {/* Suppression réservée à l'auteur du message */}
                  {isMine && (
                    <button
                      type="button"
                      className="delete-message-btn"
                      onClick={() => handleDelete(message)}
                      title={`Supprimer mon ${labels.noun}`}
                      aria-label={`Supprimer mon ${labels.noun}`}
                    >
                      <Trash2 className="onyx-icon" size={13} strokeWidth={2} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <RichContent className="message-content" content={message.content} />

                <div className="message-actions">
                  {/* Vote positif : impossible sur son propre message */}
                  <button
                    type="button"
                    className={`message-upvote-btn ${user && message.upvotedBy.includes(user.uid) ? "upvoted" : ""}`}
                    onClick={() => handleToggleUpvote(message)}
                    disabled={isMine}
                    aria-pressed={Boolean(user && message.upvotedBy.includes(user.uid))}
                    title={isMine ? `Vous ne pouvez pas voter pour votre propre ${labels.noun}` : labels.upvoteTitle}
                  >
                    <ArrowBigUp
                      className="onyx-icon onyx-icon--leading"
                      size={15}
                      strokeWidth={2}
                      fill={user && message.upvotedBy.includes(user.uid) ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                    {message.upvotesCount}
                    <span className="sr-only"> vote{message.upvotesCount > 1 ? "s" : ""}</span>
                  </button>

                  {/* Action de l'auteur du ticket : marquer ou retirer la solution */}
                  {canChooseSolution && (
                    <button
                      type="button"
                      className={`solution-toggle-btn ${isSolution ? "active" : ""}`}
                      onClick={() => handleToggleSolution(message.id)}
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
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {errorMessage && (
        <p className="thread-error" role="alert">
          <CircleAlert className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
          {errorMessage}
        </p>
      )}

      {/* Formulaire d'envoi */}
      <form className="thread-form" onSubmit={handleSubmit}>
        {isResolved && (
          <p className="resolved-hint">
            Ce ticket est marqué comme résolu, vous pouvez tout de même compléter la réponse.
          </p>
        )}
        {/* Éditeur enrichi : texte, liens, images et blocs de code */}
        <RichTextEditor
          rows={3}
          maxLength={MAX_THREAD_MESSAGE_LENGTH}
          placeholder={labels.placeholder}
          value={draft}
          disabled={isSending}
          onChange={setDraft}
          onKeyDown={(e) => {
            // Raccourci Ctrl/Cmd + Entrée pour envoyer le message
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          ariaLabel={labels.ariaLabel}
        />
        <div className="thread-form-footer">
          <span className="thread-hint">Ctrl + Entrée pour envoyer</span>
          <button type="submit" className="send-message-btn" disabled={isSending || !draft.trim()}>
            <Send className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
            {isSending ? "Envoi..." : labels.submit}
          </button>
        </div>
      </form>
    </section>
  );
};
