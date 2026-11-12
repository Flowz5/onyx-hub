import React, { useState, useMemo } from "react";
import type { ChannelActiveTab } from "./ChannelTabSelector";
import type { TicketStatus } from "../types/ticket";
import "./FeedSearchBar.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { CircleCheck, CircleDot, Clock3, Flame, Hourglass, Plus, Search, Tag, X } from "lucide-react";

export type PostSortOption = "latest" | "popular";

// Nombre de tags principaux affichés par défaut, hors recherche
const MAX_VISIBLE_TAGS = 6;
// Nombre maximal de résultats affichés lors d'une recherche de tags
const MAX_SEARCH_RESULTS = 12;

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
  // Tags disponibles, triés du plus important au moins important
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
  // Requête locale de recherche parmi les tags
  const [tagSearchQuery, setTagSearchQuery] = useState("");

  // Sélection des tags à afficher : les principaux par défaut, les correspondances en recherche
  const { visibleTags, hiddenCount } = useMemo(() => {
    const query = tagSearchQuery.toLowerCase().trim();

    if (query) {
      const matched = availableTags.filter((tag) => tag.toLowerCase().includes(query));
      return {
        visibleTags: matched.slice(0, MAX_SEARCH_RESULTS),
        hiddenCount: Math.max(matched.length - MAX_SEARCH_RESULTS, 0),
      };
    }

    const mainTags = availableTags.slice(0, MAX_VISIBLE_TAGS);
    // Le tag actif reste toujours visible, même s'il ne fait pas partie des principaux
    if (selectedTag !== "Tous" && !mainTags.includes(selectedTag)) {
      mainTags.push(selectedTag);
    }
    return {
      visibleTags: mainTags,
      hiddenCount: Math.max(availableTags.length - mainTags.length, 0),
    };
  }, [availableTags, tagSearchQuery, selectedTag]);

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
              <X className="onyx-icon" size={12} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Bouton de création contextuel */}
        <button
          type="button"
          className="create-feed-item-btn"
          onClick={onOpenCreateModal}
        >
          <span className="btn-icon"><Plus className="onyx-icon" size={17} strokeWidth={2} aria-hidden="true" /></span>
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
              <Clock3 className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
              Plus récents
            </button>
            <button
              type="button"
              className={`sort-btn ${postSort === "popular" ? "active" : ""}`}
              onClick={() => onPostSortChange("popular")}
            >
              <Flame className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
              Populaires
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
              <CircleDot className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
              Ouverts
            </button>
            <button
              type="button"
              className={`status-filter-btn in-progress ${ticketStatusFilter === "in_progress" ? "active" : ""}`}
              onClick={() => onTicketStatusFilterChange("in_progress")}
            >
              <Hourglass className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
              En cours
            </button>
            <button
              type="button"
              className={`status-filter-btn resolved ${ticketStatusFilter === "resolved" ? "active" : ""}`}
              onClick={() => onTicketStatusFilterChange("resolved")}
            >
              <CircleCheck className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
              Résolus
            </button>
          </div>
        )}

      </div>

      {/* Ligne de filtrage par tags : tags principaux à gauche, recherche à droite */}
      {availableTags.length > 0 && (
        <div className="tags-filter-row">
          <div className="feed-tag-filter-chips">
            <button
              type="button"
              className={`tag-chip ${selectedTag === "Tous" ? "active" : ""}`}
              onClick={() => onTagSelect("Tous")}
            >
              Tous les tags
            </button>
            {visibleTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`tag-chip ${selectedTag === tag ? "active" : ""}`}
                onClick={() => onTagSelect(tag)}
              >
                #{tag}
              </button>
            ))}

            {/* Indication du nombre de tags masqués, accessibles via la recherche */}
            {hiddenCount > 0 && (
              <span className="hidden-tags-hint">+{hiddenCount} autres</span>
            )}

            {tagSearchQuery && visibleTags.length === 0 && (
              <span className="hidden-tags-hint">Aucun tag pour "{tagSearchQuery}"</span>
            )}
          </div>

          {/* Champ de recherche dédié aux tags */}
          <div className="tag-search-wrapper">
            <Tag className="onyx-icon tag-search-icon" size={14} strokeWidth={2} aria-hidden="true" />
            <input
              type="text"
              className="tag-search-input"
              placeholder="Rechercher un tag..."
              value={tagSearchQuery}
              onChange={(e) => setTagSearchQuery(e.target.value)}
              aria-label="Rechercher parmi les tags du canal"
            />
            {tagSearchQuery ? (
              <button
                type="button"
                className="clear-tag-search-btn"
                onClick={() => setTagSearchQuery("")}
                title="Effacer la recherche de tags"
              >
                <X className="onyx-icon" size={12} strokeWidth={2} aria-hidden="true" />
              </button>
            ) : (
              <Search className="onyx-icon tag-search-trailing" size={13} strokeWidth={2} aria-hidden="true" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
