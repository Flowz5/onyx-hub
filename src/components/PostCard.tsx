import React from "react";
import type { Post } from "../types/post";
import "./PostCard.scss";
import { RichContent } from "./RichContent";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { ArrowBigUp, MessageSquare, Pencil, Trash2 } from "lucide-react";

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  onUpvote?: (postId: string, isCurrentlyUpvoted: boolean) => void;
  onDelete?: (postId: string) => void;
  // Ouverture de la modale d'édition (auteur uniquement)
  onEdit?: (post: Post) => void;
}

// Composant représentant une publication dans le flux Reddit-like
export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  onUpvote,
  onDelete,
  onEdit,
}) => {
  const isAuthor = currentUserId && post.authorId === currentUserId;
  const isUpvoted = Boolean(currentUserId && post.upvotedBy.includes(currentUserId));

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
        `Voulez-vous supprimer ce post "${post.title}" ?`
      );
      if (confirmDelete) {
        onDelete(post.id);
      }
    }
  };

  return (
    <article className="post-card-item">
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
          <span className="post-author">Posté par <strong>{post.authorName}</strong></span>
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
          <div className="comments-indicator">
            <span className="icon"><MessageSquare className="onyx-icon" size={15} strokeWidth={2} aria-hidden="true" /></span>
            <span>{post.commentsCount} commentaires</span>
          </div>

          {/* Actions réservées à l'auteur : modification et suppression */}
          {isAuthor && (onEdit || onDelete) && (
            <div className="author-actions">
              {onEdit && (
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
              {onDelete && (
                <button
                  type="button"
                  className="delete-post-btn"
                  onClick={handleDeleteClick}
                  title="Supprimer mon post"
                  aria-label="Supprimer mon post"
                >
                  <Trash2 className="onyx-icon" size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
