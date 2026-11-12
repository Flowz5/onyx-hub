import React, { useState, useEffect } from "react";
import type { NewTicketFormData, TicketPriority } from "../types/ticket";
import "./CreateTicketModal.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { Check, CircleAlert, Plus, SignalHigh, SignalLow, SignalMedium, X } from "lucide-react";

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Enregistrement asynchrone : la promesse est rejetée en cas d'échec Firestore
  onSubmit: (data: NewTicketFormData) => Promise<void>;
  suggestedTags?: string[];
}

const DEFAULT_TICKET_TAGS = ["Bug", "Exercice", "Compréhension", "Installation", "Examen"];

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  suggestedTags = DEFAULT_TICKET_TAGS,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [selectedTags, setSelectedTags] = useState<string[]>(["Exercice"]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Indicateur d'envoi en cours, empêchant les doubles soumissions
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setSelectedTags(["Exercice"]);
      setCustomTagInput("");
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      if (selectedTags.length >= 4) {
        setErrorMessage("Vous pouvez associer 4 tags maximum.");
        return;
      }
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const clean = customTagInput.trim();
    if (!clean) return;
    if (selectedTags.map((t) => t.toLowerCase()).includes(clean.toLowerCase())) {
      setCustomTagInput("");
      return;
    }
    if (selectedTags.length >= 4) {
      setErrorMessage("Vous pouvez associer 4 tags maximum.");
      return;
    }
    setSelectedTags([...selectedTags, clean]);
    setCustomTagInput("");
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const cleanTitle = title.trim();
    const cleanDesc = description.trim();

    if (!cleanTitle) {
      setErrorMessage("Veuillez indiquer le titre de votre problème.");
      return;
    }

    if (cleanTitle.length < 5) {
      setErrorMessage("Le titre doit comporter au moins 5 caractères.");
      return;
    }

    if (!cleanDesc) {
      setErrorMessage("Veuillez décrire précisément votre blocage.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: cleanTitle,
        description: cleanDesc,
        priority,
        tags: selectedTags,
      });
    } catch {
      // Message affiché dans la modale, qui reste ouverte pour permettre une nouvelle tentative
      setErrorMessage("L'enregistrement a échoué. Vérifiez votre connexion puis réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-ticket-overlay" onClick={onClose}>
      <div
        className="create-ticket-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-ticket-title"
      >
        <div className="modal-header">
          <div className="header-title-area">
            <span className="modal-badge ticket">DEMANDE D'AIDE</span>
            <h2 id="modal-ticket-title">Ouvrir un ticket d'assistance</h2>
            <p>Décrivez votre problème technique ou de cours pour obtenir de l'aide.</p>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            aria-label="Fermer la modale"
          >
            <X className="onyx-icon" size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {errorMessage && (
          <div className="modal-error-banner" role="alert">
            <span className="error-icon"><CircleAlert className="onyx-icon" size={18} strokeWidth={2} aria-hidden="true" /></span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="ticket-title-input" className="form-label">
              Sujet du problème <span className="required-mark">*</span>
            </label>
            <input
              id="ticket-title-input"
              type="text"
              className="modal-input"
              placeholder="ex: Erreur CORS sur requête POST, exercice 3 TD algèbre..."
              maxLength={120}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Niveau de priorité / urgence</label>
            <div className="priority-options-row">
              <button
                type="button"
                className={`priority-btn low ${priority === "low" ? "active" : ""}`}
                onClick={() => setPriority("low")}
              >
                <SignalLow className="onyx-icon onyx-icon--leading" size={15} strokeWidth={2} aria-hidden="true" />
                Faible
              </button>
              <button
                type="button"
                className={`priority-btn medium ${priority === "medium" ? "active" : ""}`}
                onClick={() => setPriority("medium")}
              >
                <SignalMedium className="onyx-icon onyx-icon--leading" size={15} strokeWidth={2} aria-hidden="true" />
                Normale
              </button>
              <button
                type="button"
                className={`priority-btn high ${priority === "high" ? "active" : ""}`}
                onClick={() => setPriority("high")}
              >
                <SignalHigh className="onyx-icon onyx-icon--leading" size={15} strokeWidth={2} aria-hidden="true" />
                Urgente
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="ticket-desc-input" className="form-label">
              Description détaillée du blocage <span className="required-mark">*</span>
            </label>
            <textarea
              id="ticket-desc-input"
              className="modal-textarea"
              rows={5}
              placeholder="Collez vos messages d'erreur, le contexte du code ou la question spécifique..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Thématiques & Tags</label>
            <div className="selected-tags-chips">
              {selectedTags.map((tag) => (
                <span key={tag} className="tag-chip">
                  #{tag}
                  <button
                    type="button"
                    className="remove-chip-btn"
                    onClick={() => toggleTag(tag)}
                  >
                    <X className="onyx-icon" size={12} strokeWidth={2} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>

            <div className="suggestions-list">
              <span className="suggest-label">Suggestions :</span>
              {suggestedTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`suggest-tag-btn ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {isSelected ? (
                      <Check className="onyx-icon onyx-icon--leading" size={12} strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Plus className="onyx-icon onyx-icon--leading" size={12} strokeWidth={2} aria-hidden="true" />
                    )}
                    {tag}
                  </button>
                );
              })}
            </div>

            <div className="custom-tag-row">
              <input
                type="text"
                className="custom-tag-input"
                placeholder="Ajouter un tag..."
                value={customTagInput}
                maxLength={25}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTag(e);
                  }
                }}
              />
              <button
                type="button"
                className="add-tag-btn"
                onClick={handleAddCustomTag}
              >
                Ajouter
              </button>
            </div>
          </div>

          <div className="modal-actions-footer">
            <button type="button" className="cancel-btn" onClick={onClose} disabled={isSubmitting}>
              Annuler
            </button>
            <button type="submit" className="submit-create-btn" disabled={isSubmitting}>
              {isSubmitting ? "Ouverture..." : "Ouvrir le ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
