import React, { useState, useMemo } from "react";
import "./ChannelSearchBar.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { X } from "lucide-react";

// Propriétés attendues pour le composant de recherche et de filtrage par tags
interface ChannelSearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedTag: string;
  onTagSelect: (tag: string) => void;
  availableTags: string[];
}

// Composant réutilisable pour la recherche de canaux et le filtrage dynamique par tags
export const ChannelSearchBar: React.FC<ChannelSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedTag,
  onTagSelect,
  availableTags,
}) => {
  // État local pour la recherche spécifique au sein des tags
  const [tagSearchQuery, setTagSearchQuery] = useState("");

  // Filtrage des tags disponibles selon la requête de recherche de tags
  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) {
      return availableTags;
    }
    const query = tagSearchQuery.toLowerCase().trim();
    // On conserve toujours l'option "Tous" en premier
    const matched = availableTags.filter(
      (tag) => tag === "Tous" || tag.toLowerCase().includes(query)
    );
    return matched;
  }, [availableTags, tagSearchQuery]);

  return (
    <section className="channel-search-bar-component">
      {/* Barre de recherche principale de canaux */}
      <div className="main-search-wrapper">
        <span className="search-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="text"
          className="search-input"
          placeholder="Rechercher un canal, une matière, un sujet..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="clear-search-btn"
            onClick={() => onSearchChange("")}
            title="Effacer la recherche de canaux"
          >
            <X className="onyx-icon" size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Barre de gestion des tags avec recherche dédiée */}
      <div className="tags-management-area">
        {/* Champ de recherche pour filtrer parmi la liste des tags */}
        <div className="tag-filter-search-wrapper">
          <span className="tag-search-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          </span>
          <input
            type="text"
            className="tag-filter-input"
            placeholder="Filtrer les tags..."
            value={tagSearchQuery}
            onChange={(e) => setTagSearchQuery(e.target.value)}
          />
          {tagSearchQuery && (
            <button
              type="button"
              className="clear-tag-search-btn"
              onClick={() => setTagSearchQuery("")}
              title="Effacer le filtre de tags"
            >
              <X className="onyx-icon" size={12} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Liste des pilules de tags */}
        <div className="tags-pills-list">
          {filteredTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`tag-pill ${selectedTag === tag ? "active" : ""}`}
              onClick={() => onTagSelect(tag)}
            >
              {tag !== "Tous" && <span className="tag-hash">#</span>}
              {tag}
            </button>
          ))}

          {filteredTags.length === 0 && (
            <span className="no-tags-matched">Aucun tag trouvé pour "{tagSearchQuery}"</span>
          )}
        </div>
      </div>
    </section>
  );
};
