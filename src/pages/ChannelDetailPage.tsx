import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { OnyxLogo } from "../components/OnyxLogo";
import "./ChannelDetailPage.scss";

// Page dédiée à la consultation d'un canal spécifique (pour l'instant vide)
export const ChannelDetailPage: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const { user, signOutUser } = useAuth();

  return (
    <div className="channel-detail-page-container">
      {/* Barre de navigation supérieure */}
      <header className="channel-detail-topbar">
        <div className="topbar-brand" onClick={() => navigate("/channels")} role="button" tabIndex={0}>
          <OnyxLogo size={40} showHexHalo={false} />
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

      {/* Barre d'en-tête du canal avec bouton de retour */}
      <nav className="channel-sub-nav">
        <button
          type="button"
          className="back-to-channels-btn"
          onClick={() => navigate("/channels")}
        >
          <span className="back-arrow">←</span>
          <span>Retour aux canaux</span>
        </button>
        <span className="current-channel-crumb">
          Canal : <strong>#{channelId}</strong>
        </span>
      </nav>

      {/* Contenu principal de la page du canal */}
      <main className="channel-detail-main">
        <div className="channel-empty-canvas">
          <div className="canvas-icon-wrapper">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2>Espace de discussion & Tickets</h2>
          <p className="canvas-description">
            Vous consultez actuellement le canal <strong>#{channelId}</strong>.
            Cet espace accueillera prochainement les messages instantanés, les questions de cours et les tickets d'assistance entre étudiants.
          </p>
          <div className="canvas-status-tag">
            <span className="pulse-dot" />
            <span>EN ATTENTE DES PREMIERS ÉCHANGES</span>
          </div>
        </div>
      </main>
    </div>
  );
};
