import React from "react";
import { Link } from "react-router-dom";
import "./AppTopbar.scss";
import { useAuth } from "../context/AuthContext";
import { useUserProfile } from "../hooks/useUserProfile";
import { OnyxLogo } from "./OnyxLogo";
import { NotificationCenter } from "./NotificationCenter";
import { UserAvatar } from "./UserAvatar";

// Barre de navigation commune aux pages connectées :
// logo (retour aux canaux), accès à son profil, notifications et déconnexion
export const AppTopbar: React.FC = () => {
  const { user, signOutUser } = useAuth();
  const profile = useUserProfile(user?.uid);
  const displayName = profile?.displayName || user?.displayName || "Étudiant";

  return (
    <header className="app-topbar">
      <Link to="/channels" className="topbar-brand" title="Retour aux canaux">
        <OnyxLogo size={42} showHexHalo={false} />
        <div className="topbar-title">
          <span className="brand-name">ONYX <strong>HUB</strong></span>
          <span className="brand-badge">CLASSE ACTIVE</span>
        </div>
      </Link>

      <div className="topbar-user-area">
        {user && (
          <Link to={`/profile/${user.uid}`} className="topbar-profile-link" title="Mon profil">
            <span className="user-details">
              <span className="user-name">{displayName}</span>
              <span className="user-email">{user.email}</span>
            </span>
            <UserAvatar uid={user.uid} fallbackName={displayName} size={38} />
          </Link>
        )}
        <NotificationCenter />
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
  );
};
