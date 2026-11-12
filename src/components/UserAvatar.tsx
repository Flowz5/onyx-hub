import React from "react";
import { Link } from "react-router-dom";
import "./UserAvatar.scss";
import { useUserProfile } from "../hooks/useUserProfile";

// Initiales affichées lorsque l'étudiant n'a pas de photo de profil
const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

interface UserAvatarProps {
  uid: string;
  // Nom enregistré sur le contenu, utilisé tant que le profil n'est pas chargé
  fallbackName?: string;
  size?: number;
}

// Pastille ronde : photo de profil ou initiales sur fond doré
export const UserAvatar: React.FC<UserAvatarProps> = ({ uid, fallbackName = "Étudiant", size = 28 }) => {
  const profile = useUserProfile(uid);
  const name = profile?.displayName || fallbackName;

  return (
    <span
      className="user-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {profile?.photoDataUrl ? (
        <img src={profile.photoDataUrl} alt="" />
      ) : (
        <span className="user-avatar-initials">{getInitials(name)}</span>
      )}
    </span>
  );
};

interface AuthorLinkProps {
  uid: string;
  fallbackName: string;
  avatarSize?: number;
  className?: string;
}

// Avatar et nom à jour de l'auteur d'un contenu, avec lien vers son profil
export const AuthorLink: React.FC<AuthorLinkProps> = ({ uid, fallbackName, avatarSize = 24, className = "" }) => {
  const profile = useUserProfile(uid);
  const name = profile?.displayName || fallbackName;

  // Contenus anciens sans identifiant d'auteur : affichage du nom seul
  if (!uid) return <strong className={`author-link ${className}`}>{name}</strong>;

  return (
    <Link
      to={`/profile/${uid}`}
      className={`author-link ${className}`}
      onClick={(e) => e.stopPropagation()}
      title={`Voir le profil de ${name}`}
    >
      <UserAvatar uid={uid} fallbackName={name} size={avatarSize} />
      <strong>{name}</strong>
    </Link>
  );
};
