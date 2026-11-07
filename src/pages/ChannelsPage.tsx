import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { OnyxLogo } from "../components/OnyxLogo";
import "./ChannelsPage.scss";

// Structure de données descriptive d'un canal de discussion
export interface Channel {
  id: string;
  name: string;
  description: string;
  tags: string[];
  ticketsCount: number;
  postsCount: number;
}

// Liste des filtres par tags disponibles pour la recherche
const AVAILABLE_TAGS: string[] = [
  "Tous",
  "Dev Web",
  "Cybersécurité",
  "Réseaux & Système",
  "Bases de Données",
  "Maths & Algo",
  "Général",
];

// Page principale affichant l'espace de gestion et de consultation des canaux
export const ChannelsPage: React.FC = () => {
  const { user, signOutUser } = useAuth();

  // État local pour la requête de recherche textuelle
  const [searchQuery, setSearchQuery] = useState("");

  // État local pour le tag actuellement sélectionné
  const [selectedTag, setSelectedTag] = useState("Tous");

  // Liste actuelle des canaux (initialisée vide selon la demande)
  const [channels] = useState<Channel[]>([]);

  // Filtrage dynamique des canaux selon la recherche textuelle et le tag sélectionné
  const filteredChannels = channels.filter((channel) => {
    const matchesSearch =
      channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag =
      selectedTag === "Tous" || channel.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  // Gestionnaire de réinitialisation des filtres de recherche
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedTag("Tous");
  };

  // Gestionnaire d'action pour la création d'un nouveau canal
  const handleCreateChannel = () => {
    // Action prête pour l'ouverture de la modale de création
    console.log("Action de création de canal déclenchée");
  };

  return (
    <div className="channels-page-container">
      {/* Barre de navigation supérieure */}
      <header className="channels-topbar">
        <div className="topbar-brand">
          <OnyxLogo size={42} showHexHalo={false} />
          <div className="topbar-title">
            <span className="brand-name">ONYX <strong>HUB</strong></span>
            <span className="brand-badge">CLASSE ACTIVE</span>
          </div>
        </div>

        <div className="topbar-user-area">
          <div className="user-details">
            <span className="user-name">{user?.displayName || "Étudiant"}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button
            type="button"
            className="signout-header-btn"
            onClick={signOutUser}
            title="Se déconnecter"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Contenu principal de l'espace channels */}
      <main className="channels-main-content">
        {/* Section de recherche et de filtres par tags */}
        <section className="search-filter-section">
          {/* Barre de recherche avec icône */}
          <div className="search-bar-wrapper">
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
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery("")}
                title="Effacer la recherche"
              >
                ✕
              </button>
            )}
          </div>

          {/* Liste des tags de filtrage */}
          <div className="tags-filter-bar">
            {AVAILABLE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`tag-pill ${selectedTag === tag ? "active" : ""}`}
                onClick={() => setSelectedTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* En-tête de la liste des canaux avec bouton de création */}
        <div className="channels-section-header">
          <div className="section-title-group">
            <div className="title-with-badge">
              <h3>Canaux disponibles</h3>
              <span className="channels-count-badge">
                {filteredChannels.length} {filteredChannels.length > 1 ? "canaux" : "canal"}
              </span>
            </div>
            <p>Accédez aux espaces d'échange ou démarrez un nouveau sujet d'entraide.</p>
          </div>

          {/* Bouton pour créer un canal */}
          <button
            type="button"
            className="create-channel-btn"
            onClick={handleCreateChannel}
          >
            <span className="btn-icon">+</span>
            <span>Créer un canal</span>
          </button>
        </div>

        {/* Liste des canaux ou affichage de l'état vide */}
        {filteredChannels.length === 0 ? (
          <div className="empty-channels-state">
            <div className="empty-icon-wrapper">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="9" y1="7" x2="15" y2="7" />
                <line x1="9" y1="11" x2="13" y2="11" />
              </svg>
            </div>

            {searchQuery || selectedTag !== "Tous" ? (
              <>
                <h4>Aucun canal correspondant</h4>
                <p>Aucun canal ne correspond à vos critères de recherche actuels.</p>
                <button
                  type="button"
                  className="reset-filters-btn"
                  onClick={handleResetFilters}
                >
                  Réinitialiser les filtres
                </button>
              </>
            ) : (
              <>
                <h4>Aucun canal pour le moment</h4>
                <p>
                  Soyez le premier à créer un canal pour échanger des cours, poser des questions ou ouvrir des tickets d'assistance.
                </p>
                <button
                  type="button"
                  className="create-first-channel-btn"
                  onClick={handleCreateChannel}
                >
                  + Créer le premier canal
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="channels-grid">
            {filteredChannels.map((channel) => (
              <article key={channel.id} className="channel-card">
                <div className="channel-card-header">
                  <span className="channel-tags">{channel.tags.join(" • ")}</span>
                  <span className="channel-hash">#</span>
                </div>
                <h4 className="channel-name">{channel.name}</h4>
                <p className="channel-description">{channel.description}</p>
                <div className="channel-card-footer">
                  <span className="channel-enter-text">Accéder au channel →</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

