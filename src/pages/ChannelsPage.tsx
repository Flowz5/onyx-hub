import React from "react";
import { useAuth } from "../context/AuthContext";
import { OnyxLogo } from "../components/OnyxLogo";
import "./ChannelsPage.scss";

// Structure de données descriptive d'un canal de cours
interface ChannelPreview {
  id: string;
  name: string;
  description: string;
  category: string;
  ticketsCount: number;
  postsCount: number;
}

// Données d'aperçu des premiers canaux de la classe
const PREVIEW_CHANNELS: ChannelPreview[] = [
  {
    id: "web-mobile",
    name: "Développement Web & Mobile",
    description: "React, React Native, TypeScript, APIs et architectures modernes.",
    category: "Projet Principal",
    ticketsCount: 4,
    postsCount: 12,
  },
  {
    id: "algo-maths",
    name: "Algorithmique & Structures",
    description: "Complexité, arbres, graphes, optimisation et exercices de TD.",
    category: "Tronc Commun",
    ticketsCount: 2,
    postsCount: 7,
  },
  {
    id: "db-cloud",
    name: "Bases de Données & Cloud",
    description: "PostgreSQL, Firebase, Firestore, modélisation et requêtes.",
    category: "Infrastructures",
    ticketsCount: 3,
    postsCount: 9,
  },
  {
    id: "entraide-generale",
    name: "Entraide Générale & Vie de Promo",
    description: "Partage de ressources de cours, annales, questions diverses et organisation.",
    category: "Général",
    ticketsCount: 1,
    postsCount: 18,
  },
];

// Page principale affichant la liste des channels pour les élèves connectés
export const ChannelsPage: React.FC = () => {
  const { user, signOutUser } = useAuth();

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
            <span className="user-name">{user?.displayName || "Élève"}</span>
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
        {/* Bannière de notification : fonctionnalité en cours de développement */}
        <section className="construction-banner">
          <div className="banner-status-tag">
            <span className="pulse-indicator" />
            <span>ÉTAPE EN COURS : GESTION DES CHANNELS</span>
          </div>
          <h2>Espace des Channels & Tickets</h2>
          <p>
            Vous êtes connecté avec succès à <strong>Onyx Hub</strong> ! Le système d'authentification et de routage est opérationnel. La prochaine étape permettra de créer de vrais canaux, d'y déposer des tickets d'assistance et de publier des posts.
          </p>
        </section>

        {/* En-tête de section avec bouton d'action */}
        <div className="channels-section-header">
          <div>
            <h3>Canaux de discussion ouverts</h3>
            <p>Sélectionnez un canal pour consulter les tickets d'aide ou poser une question.</p>
          </div>
          <button type="button" className="create-channel-btn" disabled>
            + Créer un Channel (Bientôt)
          </button>
        </div>

        {/* Grille des channels prévisualisés */}
        <div className="channels-grid">
          {PREVIEW_CHANNELS.map((channel) => (
            <article key={channel.id} className="channel-card">
              <div className="channel-card-header">
                <span className="channel-category">{channel.category}</span>
                <span className="channel-hash">#</span>
              </div>
              <h4 className="channel-name">{channel.name}</h4>
              <p className="channel-description">{channel.description}</p>
              
              <div className="channel-stats">
                <div className="stat-item tickets">
                  <span className="stat-value">{channel.ticketsCount}</span>
                  <span className="stat-label">Tickets ouverts</span>
                </div>
                <div className="stat-item posts">
                  <span className="stat-value">{channel.postsCount}</span>
                  <span className="stat-label">Posts</span>
                </div>
              </div>

              <div className="channel-card-footer">
                <span className="channel-enter-text">Accéder au channel →</span>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
};
