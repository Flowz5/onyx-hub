import React from "react";
import type { ChannelActiveTab } from "./ChannelTabSelector";
import type { TicketStatus } from "../types/ticket";
import "./FeedSearchBar.scss";

export type PostSortOption = "latest" | "popular";

interface FeedSearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeTab: ChannelActiveTab;
  postSort: PostSortOption;
  onPostSortChange: (sort: PostSortOption) => void;
  ticketStatusFilter: "all" | TicketStatus;
  onTicketStatusFilterChange: (status: "all" | TicketStatus) => void;
  selectedTag: string;
  onTagSelect: (tag: string) => void;
  availableTags: string[];
  onOpenCreateModal: () => void;
}

// Composant de recherche et de filtrage dédié au flux déroulant d'un canal
export const FeedSearchBar: React.FC<FeedSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  activeTab,
  postSort,
  onPostSortChange,
  ticketStatusFilter,
  onTicketStatusFilterChange,
  selectedTag,
  onTagSelect,
  availableTags,
  onOpenCreateModal,
}) => {
  return (
    <div className="feed-search-bar-component">
      {/* Ligne principale : Recherche textuelle et Bouton d'action de création */}
      <div className="search-actions-row">
        {/* Champ de recherche */}
        <div className="feed-input-wrapper">
          <span className="search-icon" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            className="feed-search-input"
            placeholder={
              activeTab === "posts"
                ? "Rechercher parmi les posts et discussions..."
                : "Rechercher un ticket d'aide, un exercice..."
            }
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => onSearchChange("")}
              title="Effacer la recherche"
            >
              ✕
            </button>
          )}
        </div>

        {/* Bouton de création contextuel */}
        <button
          type="button"
          className="create-feed-item-btn"
          onClick={onOpenCreateModal}
        >
          <span className="btn-icon">+</span>
          <span>
            {activeTab === "posts" ? "Nouveau Post" : "Nouveau Ticket"}
          </span>
        </button>
      </div>

      {/* Ligne des filtres secondaires de tri et d'état */}
      <div className="filters-sub-row">
        {/* Filtres contextuels selon l'onglet actif */}
        {activeTab === "posts" ? (
          <div className="sort-buttons-group">
            <button
              type="button"
              className={`sort-btn ${postSort === "latest" ? "active" : ""}`}
              onClick={() => onPostSortChange("latest")}
            >
              ⏰ Plus récents
            </button>
            <button
              type="button"
              className={`sort-btn ${postSort === "popular" ? "active" : ""}`}
              onClick={() => onPostSortChange("popular")}
            >
              🔥 Populaires
            </button>
          </div>
        ) : (
          <div className="ticket-status-filter-group">
            <button
              type="button"
              className={`status-filter-btn ${ticketStatusFilter === "all" ? "active" : ""}`}
              onClick={() => onTicketStatusFilterChange("all")}
            >
              Tous
            </button>
            <button
              type="button"
              className={`status-filter-btn open ${ticketStatusFilter === "open" ? "active" : ""}`}
              onClick={() => onTicketStatusFilterChange("open")}
            >
              🟢 Ouverts
            </button>
            <button
              type="button"
              className={`status-filter-btn in-progress ${ticketStatusFilter === "in_progress" ? "active" : ""}`}
              onClick={() => onTicketStatusFilterChange("in_progress")}
            >
              🟡 En cours
            </button>
            <button
              type="button"
              className={`status-filter-btn resolved ${ticketStatusFilter === "resolved" ? "active" : ""}`}
              onClick={() => onTicketStatusFilterChange("resolved")}
            >
              🟣 Résolus
            </button>
          </div>
        )}

        {/* Filtrage rapide par tags si disponibles */}
        {availableTags.length > 0 && (
          <div className="feed-tag-filter-chips">
            <button
              type="button"
              className={`tag-chip ${selectedTag === "Tous" ? "active" : ""}`}
              onClick={() => onTagSelect("Tous")}
            >
              Tous les tags
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`tag-chip ${selectedTag === tag ? "active" : ""}`}
                onClick={() => onTagSelect(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
