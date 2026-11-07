import React from "react";
import type { Post } from "../types/post";
import "./PostCard.scss";

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  onUpvote?: (postId: string, isCurrentlyUpvoted: boolean) => void;
  onDelete?: (postId: string) => void;
}

// Composant représentant une publication dans le flux Reddit-like
export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  onUpvote,
  onDelete,
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
          ▲
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
        <p className="post-body-text">{post.content}</p>

        {/* Pied de carte avec actions */}
        <div className="post-footer">
          <div className="comments-indicator">
            <span className="icon">💬</span>
            <span>{post.commentsCount} commentaires</span>
          </div>

          {/* Bouton de suppression réservé à l'auteur */}
          {isAuthor && onDelete && (
            <button
              type="button"
              className="delete-post-btn"
              onClick={handleDeleteClick}
              title="Supprimer mon post"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
