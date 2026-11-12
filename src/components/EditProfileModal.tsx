import React, { useEffect, useRef, useState } from "react";
import "./EditProfileModal.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { Camera, CircleAlert, Trash2, UserPen, X } from "lucide-react";
import { compressAvatar } from "../services/profileService";
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MIN_DISPLAY_NAME_LENGTH,
  type EditableProfileFields,
} from "../types/profile";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFields: EditableProfileFields;
  // Enregistrement asynchrone : la promesse est rejetée en cas d'échec Firestore
  onSave: (fields: EditableProfileFields) => Promise<void>;
}

// Modale d'édition du profil : photo, nom affiché et bio
export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  initialFields,
  onSave,
}) => {
  const [displayName, setDisplayName] = useState(initialFields.displayName);
  const [bio, setBio] = useState(initialFields.bio);
  const [photoDataUrl, setPhotoDataUrl] = useState(initialFields.photoDataUrl);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Réinitialisation du formulaire à chaque ouverture
  const { displayName: initialName, bio: initialBio, photoDataUrl: initialPhoto } = initialFields;
  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(initialName);
    setBio(initialBio);
    setPhotoDataUrl(initialPhoto);
    setErrorMessage(null);
    setIsSaving(false);
  }, [isOpen, initialName, initialBio, initialPhoto]);

  // Fermeture via la touche Échap, bloquée pendant l'enregistrement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSaving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const trimmedName = displayName.trim();
  const trimmedBio = bio.trim();
  const isNameValid =
    trimmedName.length >= MIN_DISPLAY_NAME_LENGTH && trimmedName.length <= MAX_DISPLAY_NAME_LENGTH;
  const hasChanges =
    trimmedName !== initialName || trimmedBio !== initialBio || photoDataUrl !== initialPhoto;

  // Recadrage et compression de la photo choisie
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsProcessingPhoto(true);
    setErrorMessage(null);
    try {
      setPhotoDataUrl(await compressAvatar(file));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de traiter cette image.");
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !hasChanges || !isNameValid) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSave({ displayName: trimmedName, bio: trimmedBio, photoDataUrl });
      onClose();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du profil :", error);
      setErrorMessage("L'enregistrement du profil a échoué. Réessayez dans un instant.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="edit-profile-overlay" onClick={() => !isSaving && onClose()}>
      <form
        className="edit-profile-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
      >
        {/* En-tête de la modale */}
        <div className="modal-header">
          <div className="header-icon-box">
            <UserPen className="onyx-icon" size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="header-title-area">
            <h2 id="edit-profile-title">Modifier mon profil</h2>
            <p>Ces informations sont visibles par tous les membres d'Onyx Hub.</p>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Fermer la modale"
          >
            <X className="onyx-icon" size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {errorMessage && (
          <div className="modal-error-banner" role="alert">
            <CircleAlert className="onyx-icon" size={18} strokeWidth={2} aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Photo de profil : aperçu, remplacement et suppression */}
        <div className="photo-field">
          <div className="photo-preview">
            {photoDataUrl ? (
              <img src={photoDataUrl} alt="Aperçu de la photo de profil" />
            ) : (
              <span className="photo-placeholder">{trimmedName.slice(0, 1).toUpperCase() || "?"}</span>
            )}
          </div>
          <div className="photo-actions">
            <button
              type="button"
              className="photo-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingPhoto || isSaving}
            >
              <Camera className="onyx-icon onyx-icon--leading" size={15} strokeWidth={2} aria-hidden="true" />
              {isProcessingPhoto ? "Traitement..." : photoDataUrl ? "Changer la photo" : "Ajouter une photo"}
            </button>
            {photoDataUrl && (
              <button
                type="button"
                className="photo-btn danger"
                onClick={() => setPhotoDataUrl(null)}
                disabled={isProcessingPhoto || isSaving}
              >
                <Trash2 className="onyx-icon onyx-icon--leading" size={15} strokeWidth={2} aria-hidden="true" />
                Retirer
              </button>
            )}
            <span className="field-hint">L'image est recadrée en carré et compressée.</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handlePhotoChange}
            hidden
          />
        </div>

        {/* Nom affiché */}
        <label className="form-field">
          <span className="field-label">Nom ou pseudo</span>
          <input
            type="text"
            className="modal-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            disabled={isSaving}
            required
          />
          {!isNameValid && (
            <span className="field-hint error">
              Entre {MIN_DISPLAY_NAME_LENGTH} et {MAX_DISPLAY_NAME_LENGTH} caractères.
            </span>
          )}
        </label>

        {/* Bio courte */}
        <label className="form-field">
          <span className="field-label">
            Bio <span className="char-counter">{bio.length}/{MAX_BIO_LENGTH}</span>
          </span>
          <textarea
            className="modal-textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={MAX_BIO_LENGTH}
            rows={3}
            placeholder="Ex : BTS SIO SLAM 2e année, fan de React et de café."
            disabled={isSaving}
          />
        </label>

        {/* Boutons d'action */}
        <div className="modal-actions-footer">
          <button type="button" className="cancel-btn" onClick={onClose} disabled={isSaving}>
            Annuler
          </button>
          <button
            type="submit"
            className="save-btn"
            disabled={isSaving || isProcessingPhoto || !hasChanges || !isNameValid}
          >
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
};
