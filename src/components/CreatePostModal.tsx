import React, { useState, useEffect } from "react";
import { MAX_POST_CONTENT_LENGTH, type NewPostFormData } from "../types/post";
import { RichTextEditor } from "./RichTextEditor";
import "./CreatePostModal.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { Check, CircleAlert, Plus, X } from "lucide-react";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Enregistrement asynchrone : la promesse est rejetée en cas d'échec Firestore
  onSubmit: (data: NewPostFormData) => Promise<void>;
  suggestedTags?: string[];
  // Mode d'utilisation : création ou édition d'un élément existant
  mode?: "create" | "edit";
  // Valeurs initiales du formulaire en mode édition
  initialData?: NewPostFormData | null;
}

const DEFAULT_SUGGESTIONS = ["Question", "Ressource", "Annonce", "Discussion", "Projet"];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  suggestedTags = DEFAULT_SUGGESTIONS,
  mode = "create",
  initialData = null,
}) => {
  const isEditMode = mode === "edit";
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["Discussion"]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Indicateur d'envoi en cours, empêchant les doubles soumissions
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title ?? "");
      setContent(initialData?.content ?? "");
      setSelectedTags(initialData?.tags ?? ["Discussion"]);
      setCustomTagInput("");
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialData]);

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
    const cleanContent = content.trim();

    if (!cleanTitle) {
      setErrorMessage("Veuillez donner un titre à votre publication.");
      return;
    }

    if (cleanTitle.length < 4) {
      setErrorMessage("Le titre doit comporter au moins 4 caractères.");
      return;
    }

    if (!cleanContent) {
      setErrorMessage("Veuillez rédiger le contenu de votre message.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: cleanTitle,
        content: cleanContent,
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
    <div className="create-post-overlay" onClick={onClose}>
      <div
        className="create-post-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-post-title"
      >
        <div className="modal-header">
          <div className="header-title-area">
            <span className="modal-badge">
              {isEditMode ? "MODIFICATION" : "NOUVELLE PUBLICATION"}
            </span>
            <h2 id="modal-post-title">
              {isEditMode ? "Modifier mon post" : "Créer un post de discussion"}
            </h2>
            <p>
              {isEditMode
                ? "Corrigez le titre, le contenu ou les tags de votre publication."
                : "Partagez une astuce, une question de cours ou une ressource utile."}
            </p>
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
            <label htmlFor="post-title-input" className="form-label">
              Titre de la publication <span className="required-mark">*</span>
            </label>
            <input
              id="post-title-input"
              type="text"
              className="modal-input"
              placeholder="ex: Comment optimiser le state en React ? Annales de maths dispo..."
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
            <label htmlFor="post-content-input" className="form-label">
              Corps du message <span className="required-mark">*</span>
            </label>
            {/* Éditeur enrichi : texte, liens, images et blocs de code */}
            <RichTextEditor
              id="post-content-input"
              rows={6}
              maxLength={MAX_POST_CONTENT_LENGTH}
              placeholder="Expliquez en détail votre sujet, partagez vos liens, images ou extraits de code..."
              value={content}
              disabled={isSubmitting}
              onChange={(nextValue) => {
                setContent(nextValue);
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
              {isSubmitting
                ? "Enregistrement..."
                : isEditMode
                  ? "Enregistrer les modifications"
                  : "Publier le post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
