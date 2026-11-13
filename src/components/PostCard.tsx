import React, { useEffect, useRef, useState } from "react";
import type { Post } from "../types/post";
import "./PostCard.scss";
import { RichContent } from "./RichContent";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { ArrowBigUp, ChevronDown, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { DiscussionThread } from "./DiscussionThread";
import { AuthorLink } from "./UserAvatar";

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  onUpvote?: (postId: string, isCurrentlyUpvoted: boolean) => void;
  onDelete?: (postId: string) => void;
  // Ouverture de la modale d'édition (auteur uniquement)
  onEdit?: (post: Post) => void;
  // Modérateur du canal (créateur ou administrateur) : suppression des posts et commentaires
  canModerate?: boolean;
  // Mise en avant depuis une notification : la carte défile à l'écran, avec son fil ouvert si besoin
  focus?: "card" | "thread" | null;
}

// Composant représentant une publication dans le flux Reddit-like
export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  onUpvote,
  onDelete,
  onEdit,
  canModerate = false,
  focus = null,
}) => {
  const isAuthor = Boolean(currentUserId && post.authorId === currentUserId);
  // Suppression ouverte à l'auteur et aux modérateurs du canal
  const canDelete = isAuthor || canModerate;
  const isUpvoted = Boolean(currentUserId && post.upvotedBy.includes(currentUserId));
  // Affichage du fil de commentaires (chargé uniquement à l'ouverture)
  const [areCommentsOpen, setAreCommentsOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  // Arrivée depuis une notification : ouverture du fil puis défilement jusqu'à la carte
  useEffect(() => {
    if (!focus) return;
    if (focus === "thread") setAreCommentsOpen(true);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  // Formatage de la date en français
  const formattedDate = new Date(post.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleUpvoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpvote) {
      onUpvote(post.id, isUpvoted);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      const confirmDelete = window.confirm(
        isAuthor
          ? `Voulez-vous supprimer ce post "${post.title}" ?`
          : `Modération : supprimer le post "${post.title}" de ${post.authorName} ?`
      );
      if (confirmDelete) {
        onDelete(post.id);
      }
    }
  };

  return (
    <article ref={cardRef} className={`post-card-item ${focus ? "is-focused" : ""}`}>
      {/* Colonne de vote Reddit-like */}
      <div className="upvote-column">
        <button
          type="button"
          className={`upvote-btn ${isUpvoted ? "upvoted" : ""}`}
          onClick={handleUpvoteClick}
          title={isUpvoted ? "Retirer votre vote" : "Voter pour ce post"}
          aria-label="Voter pour ce post"
        >
          <ArrowBigUp
            className="onyx-icon"
            size={20}
            strokeWidth={2}
            fill={isUpvoted ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
        <span className={`upvote-score ${isUpvoted ? "upvoted" : ""}`}>
          {post.upvotesCount}
        </span>
      </div>

      {/* Contenu principal du post */}
      <div className="post-content-area">
        {/* En-tête métadonnées */}
        <div className="post-meta-header">
          <span className="post-author">
            Posté par <AuthorLink uid={post.authorId} fallbackName={post.authorName} avatarSize={22} />
          </span>
          <span className="meta-separator">•</span>
          <span className="post-date">{formattedDate}</span>

          {post.tags.length > 0 && (
            <div className="post-tags-list">
              {post.tags.map((tag) => (
                <span key={tag} className="post-tag-chip">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Titre du post */}
        <h3 className="post-title">{post.title}</h3>

        {/* Corps du message */}
        <RichContent className="post-body-text" content={post.content} />

        {/* Pied de carte avec actions */}
        <div className="post-footer">
          {/* Bouton d'ouverture du fil de commentaires */}
          <button
            type="button"
            className={`toggle-comments-btn ${areCommentsOpen ? "open" : ""}`}
            onClick={() => setAreCommentsOpen((isOpen) => !isOpen)}
            aria-expanded={areCommentsOpen}
          >
            <MessageSquare className="onyx-icon onyx-icon--leading" size={15} strokeWidth={2} aria-hidden="true" />
            {post.commentsCount > 0
              ? `${post.commentsCount} commentaire${post.commentsCount > 1 ? "s" : ""}`
              : "Commenter"}
            <ChevronDown className="onyx-icon chevron" size={14} strokeWidth={2} aria-hidden="true" />
          </button>

          {/* Actions : modification par l'auteur, suppression par l'auteur ou un modérateur */}
          {((isAuthor && onEdit) || (canDelete && onDelete)) && (
            <div className="author-actions">
              {isAuthor && onEdit && (
                <button
                  type="button"
                  className="edit-post-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(post);
                  }}
                  title="Modifier mon post"
                  aria-label="Modifier mon post"
                >
                  <Pencil className="onyx-icon" size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
              {canDelete && onDelete && (
                <button
                  type="button"
                  className="delete-post-btn"
                  onClick={handleDeleteClick}
                  title={isAuthor ? "Supprimer mon post" : "Supprimer ce post (modération)"}
                  aria-label={isAuthor ? "Supprimer mon post" : "Supprimer ce post (modération)"}
                >
                  <Trash2 className="onyx-icon" size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Fil de commentaires déplié */}
        {areCommentsOpen && (
          <DiscussionThread
            kind="posts"
            parentId={post.id}
            parentAuthorId={post.authorId}
            parentTitle={post.title}
            channelId={post.channelId}
            canModerate={canModerate}
          />
        )}
      </div>
    </article>
  );
};
