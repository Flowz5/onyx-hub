import React, { useState, useEffect } from "react";
import "./ChannelMembersModal.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { CircleAlert, Lock, X } from "lucide-react";
import { MemberEmailsInput } from "./MemberEmailsInput";

interface ChannelMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelName: string;
  // Liste des membres actuellement enregistrés dans Firestore
  initialEmails: string[];
  ownerEmail?: string | null;
  // Enregistrement asynchrone : la promesse est rejetée en cas d'échec Firestore
  onSave: (emails: string[]) => Promise<void>;
}

// Modale de gestion des membres invités d'un canal privé, réservée à son créateur
export const ChannelMembersModal: React.FC<ChannelMembersModalProps> = ({
  isOpen,
  onClose,
  channelName,
  initialEmails,
  ownerEmail,
  onSave,
}) => {
  const [emails, setEmails] = useState<string[]>(initialEmails);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Réinitialisation de la liste éditée à chaque ouverture de la modale
  useEffect(() => {
    if (isOpen) {
      setEmails(initialEmails);
      setErrorMessage(null);
      setIsSaving(false);
    }
  }, [isOpen, initialEmails]);

  // Fermeture via la touche Échap, bloquée pendant l'enregistrement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSaving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  // Détection d'une modification par rapport à la liste enregistrée
  const hasChanges =
    emails.length !== initialEmails.length || emails.some((email) => !initialEmails.includes(email));

  const handleSave = async () => {
    if (isSaving || !hasChanges) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSave(emails);
      onClose();
    } catch {
      setErrorMessage("L'enregistrement des membres a échoué. Réessayez dans un instant.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="channel-members-overlay" onClick={() => !isSaving && onClose()}>
      <div
        className="channel-members-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-members-title"
      >
        {/* En-tête de la modale */}
        <div className="modal-header">
          <div className="header-icon-box">
            <Lock className="onyx-icon" size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="header-title-area">
            <h2 id="modal-members-title">Membres du canal</h2>
            <p>
              Seuls les comptes invités ci-dessous peuvent consulter <strong>#{channelName}</strong>.
            </p>
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

        <MemberEmailsInput
          emails={emails}
          onChange={setEmails}
          ownerEmail={ownerEmail}
          disabled={isSaving}
        />

        {/* Boutons d'action */}
        <div className="modal-actions-footer">
          <button type="button" className="cancel-btn" onClick={onClose} disabled={isSaving}>
            Annuler
          </button>
          <button
            type="button"
            className="save-members-btn"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
};
