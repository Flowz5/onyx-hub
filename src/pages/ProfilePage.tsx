import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ProfilePage.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { ArrowLeft, CalendarDays, CircleCheckBig, MessagesSquare, Pencil, Ticket, UserX } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useUserProfile } from "../hooks/useUserProfile";
import { AppTopbar } from "../components/AppTopbar";
import { UserAvatar } from "../components/UserAvatar";
import { EditProfileModal } from "../components/EditProfileModal";
import { updateUserProfile } from "../services/profileService";
import type { EditableProfileFields } from "../types/profile";

// Page profil d'un étudiant : photo, nom, bio et statistiques ; édition réservée au titulaire
export const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = useUserProfile(userId);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const isOwnProfile = Boolean(user && userId === user.uid);

  // Enregistrement des modifications ; l'erreur est relayée à la modale
  const handleSaveProfile = async (fields: EditableProfileFields) => {
    if (!user) throw new Error("Utilisateur non connecté.");
    await updateUserProfile(user, fields);
  };

  const stats = profile
    ? [
        { label: "Posts publiés", value: profile.postsCount, Icon: MessagesSquare },
        { label: "Tickets ouverts", value: profile.ticketsCount, Icon: Ticket },
        { label: "Solutions trouvées", value: profile.solutionsCount, Icon: CircleCheckBig },
      ]
    : [];

  return (
    <div className="profile-page-container">
      <AppTopbar />

      <main className="profile-main-content">
        <button type="button" className="profile-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft className="onyx-icon onyx-icon--leading" size={16} strokeWidth={2} aria-hidden="true" />
          Retour
        </button>

        {profile === undefined ? (
          <p className="profile-status-text">Chargement du profil...</p>
        ) : profile === null || !userId ? (
          <div className="profile-card profile-not-found">
            <UserX className="onyx-icon" size={40} strokeWidth={2} aria-hidden="true" />
            <h1>Profil introuvable</h1>
            <p>Cet étudiant n'a pas encore de profil sur Onyx Hub.</p>
          </div>
        ) : (
          <>
            {/* Carte d'identité de l'étudiant */}
            <section className="profile-card">
              <UserAvatar uid={userId} fallbackName={profile.displayName} size={112} />
              <div className="profile-identity">
                <h1>{profile.displayName}</h1>
                {profile.bio ? (
                  <p className="profile-bio">{profile.bio}</p>
                ) : (
                  <p className="profile-bio empty">
                    {isOwnProfile ? "Ajoutez une courte bio pour vous présenter." : "Pas encore de bio."}
                  </p>
                )}
                <span className="profile-since">
                  <CalendarDays className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
                  Membre depuis le{" "}
                  {new Date(profile.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              {isOwnProfile && (
                <button
                  type="button"
                  className="edit-profile-btn"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <Pencil className="onyx-icon onyx-icon--leading" size={15} strokeWidth={2} aria-hidden="true" />
                  Modifier le profil
                </button>
              )}
            </section>

            {/* Statistiques de participation */}
            <section className="profile-stats" aria-label="Statistiques">
              {stats.map(({ label, value, Icon }) => (
                <div key={label} className="profile-stat-tile">
                  <Icon className="onyx-icon" size={20} strokeWidth={2} aria-hidden="true" />
                  <span className="stat-value">{value}</span>
                  <span className="stat-label">{label}</span>
                </div>
              ))}
            </section>

            {isOwnProfile && (
              <EditProfileModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                initialFields={{
                  displayName: profile.displayName,
                  bio: profile.bio,
                  photoDataUrl: profile.photoDataUrl,
                }}
                onSave={handleSaveProfile}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};
