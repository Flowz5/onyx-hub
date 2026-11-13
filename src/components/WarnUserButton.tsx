import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./WarnUserButton.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { CircleAlert, ShieldAlert, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { sendModerationWarning, type WarningTarget } from "../services/moderationService";
import { MAX_WARNING_REASON_LENGTH } from "../types/notification";

interface WarnUserButtonProps {
  // Contenu visé et auteur destinataire de l'avertissement
  target: WarningTarget;
  // Nom de l'auteur, affiché dans la modale
  recipientName: string;
  // Nature du contenu visé (« ce post », « ce commentaire »...)
  contentLabel: string;
  // Taille du bouton : carte (post, ticket) ou message de fil
  variant?: "card" | "compact";
}

// Bouton de modération ouvrant la saisie d'un avertissement adressé à l'auteur d'un contenu.
// Réservé aux modérateurs du canal : l'affichage est conditionné par le composant parent.
export const WarnUserButton: React.FC<WarnUserButtonProps> = ({
  target,
  recipientName,
  contentLabel,
  variant = "card",
}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Confirmation affichée brièvement sur le bouton après l'envoi
  const [isSent, setIsSent] = useState(false);

  // Fermeture via la touche Échap, bloquée pendant l'envoi
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSending) setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSending]);

  // Retour à l'état normal du bouton quelques secondes après l'envoi
  useEffect(() => {
    if (!isSent) return;
    const timeout = window.setTimeout(() => setIsSent(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [isSent]);

  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setReason("");
    setErrorMessage(null);
    setIsOpen(true);
  };

  const closeModal = () => {
    if (!isSending) setIsOpen(false);
  };

  // Envoi de l'avertissement sous forme de notification au destinataire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSending || !reason.trim()) return;
    setIsSending(true);
    setErrorMessage(null);
    try {
      await sendModerationWarning(target, reason, user);
      setIsOpen(false);
      setIsSent(true);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'avertissement :", error);
      setErrorMessage("L'avertissement n'a pas pu être envoyé. Réessayez dans un instant.");
    } finally {
      setIsSending(false);
    }
  };

  const buttonLabel = isSent
    ? `Avertissement envoyé à ${recipientName}`
    : `Avertir ${recipientName} (modération)`;

  return (
    <>
      <button
        type="button"
        className={`warn-user-btn ${variant} ${isSent ? "is-sent" : ""}`}
        onClick={openModal}
        title={buttonLabel}
        aria-label={buttonLabel}
      >
        <ShieldAlert className="onyx-icon" size={variant === "card" ? 14 : 13} strokeWidth={2} aria-hidden="true" />
      </button>

      {/* Modale rendue à la racine du document : une carte animée (transform) fausserait son positionnement */}
      {isOpen &&
        createPortal(
        <div className="warn-user-overlay" onClick={closeModal}>
          <form
            className="warn-user-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="warn-user-title"
          >
            {/* En-tête de la modale */}
            <div className="modal-header">
              <div className="header-icon-box">
                <ShieldAlert className="onyx-icon" size={20} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="header-title-area">
                <h2 id="warn-user-title">Avertir {recipientName}</h2>
                <p>
                  Une notification lui sera envoyée au sujet de {contentLabel} dans{" "}
                  <strong>« {target.parentTitle} »</strong>.
                </p>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={closeModal}
                disabled={isSending}
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

            {/* Motif obligatoire, transmis tel quel au destinataire */}
            <label className="reason-field">
              <span className="reason-label">Motif de l'avertissement</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={MAX_WARNING_REASON_LENGTH}
                rows={4}
                placeholder="Ex : propos irrespectueux envers un autre étudiant, contenu hors sujet..."
                disabled={isSending}
                autoFocus
              />
              <span className="reason-counter">
                {reason.length}/{MAX_WARNING_REASON_LENGTH}
              </span>
            </label>

            {/* Boutons d'action */}
            <div className="modal-actions-footer">
              <button type="button" className="cancel-btn" onClick={closeModal} disabled={isSending}>
                Annuler
              </button>
              <button type="submit" className="send-warning-btn" disabled={isSending || !reason.trim()}>
                {isSending ? "Envoi..." : "Envoyer l'avertissement"}
              </button>
            </div>
          </form>
        </div>,
          document.body
        )}
    </>
  );
};
