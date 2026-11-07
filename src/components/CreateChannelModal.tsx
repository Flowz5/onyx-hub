import React, { useState, useEffect } from "react";
import "./CreateChannelModal.scss";

// Données requises pour la création d'un canal
export interface NewChannelFormData {
  name: string;
  description: string;
  tags: string[];
  visibility: "public" | "private";
}

// Propriétés attendues par le composant modale
interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewChannelFormData) => void;
}

// Tags thématiques prédéfinis proposés en suggestion rapide
const PRESET_TAGS = [
  "Dev Web",
  "Cybersécurité",
  "Réseaux & Système",
  "Bases de Données",
  "Maths & Algo",
  "Général",
];

// Composant modale pour la configuration et la création d'un canal
export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  // État local des champs du formulaire
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["Général"]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Réinitialisation des états à chaque réouverture de la modale
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setSelectedTags(["Général"]);
      setCustomTagInput("");
      setVisibility("public");
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Fermeture de la modale via la touche Échap
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Bascule de sélection d'un tag prédéfini
  const togglePresetTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Ajout d'un tag personnalisé saisi manuellement
  const handleAddCustomTag = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const trimmed = customTagInput.trim();
    if (!trimmed) return;

    if (selectedTags.map((t) => t.toLowerCase()).includes(trimmed.toLowerCase())) {
      setCustomTagInput("");
      return;
    }

    if (selectedTags.length >= 5) {
      setErrorMessage("Vous pouvez associer jusqu'à 5 tags maximum par canal.");
      return;
    }

    setSelectedTags([...selectedTags, trimmed]);
    setCustomTagInput("");
    setErrorMessage(null);
  };

  // Retrait d'un tag sélectionné
  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tagToRemove));
  };

  // Validation et soumission du formulaire
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setErrorMessage("Veuillez donner un nom à votre canal.");
      return;
    }

    if (cleanName.length < 3) {
      setErrorMessage("Le nom du canal doit comporter au moins 3 caractères.");
      return;
    }

    if (selectedTags.length === 0) {
      setErrorMessage("Veuillez sélectionner au moins un tag thématique.");
      return;
    }

    setErrorMessage(null);
    onSubmit({
      name: cleanName,
      description: description.trim(),
      tags: selectedTags,
      visibility,
    });
  };

  return (
    <div className="create-channel-overlay" onClick={onClose}>
      <div
        className="create-channel-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-channel-title"
      >
        {/* En-tête de la modale */}
        <div className="modal-header">
          <div className="header-title-area">
            <span className="modal-badge">ESPACE DE DISCUSSION</span>
            <h2 id="modal-channel-title">Créer un nouveau canal</h2>
            <p>Configurez la thématique, la description et la visibilité d'accès.</p>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            aria-label="Fermer la modale"
          >
            ✕
          </button>
        </div>

        {/* Message d'erreur de validation si présent */}
        {errorMessage && (
          <div className="modal-error-banner" role="alert">
            <span className="error-icon">!</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Corps du formulaire */}
        <form onSubmit={handleSubmit} className="modal-form">
          {/* Nom du canal */}
          <div className="form-group">
            <label htmlFor="channel-name" className="form-label">
              Nom du canal <span className="required-mark">*</span>
            </label>
            <div className="input-prefix-wrapper">
              <span className="input-prefix">#</span>
              <input
                id="channel-name"
                type="text"
                className="modal-input has-prefix"
                placeholder="ex: developpement-web, algo-structure, cyber..."
                maxLength={45}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoFocus
              />
            </div>
            <span className="field-hint">Court, explicite et représentatif du sujet traité.</span>
          </div>

          {/* Description du canal */}
          <div className="form-group">
            <label htmlFor="channel-desc" className="form-label">
              Description de l'espace
            </label>
            <textarea
              id="channel-desc"
              className="modal-textarea"
              rows={3}
              placeholder="Expliquez brièvement le sujet, le type d'entraide ou les cours concernés..."
              maxLength={220}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="char-counter">{description.length}/220</div>
          </div>

          {/* Sélection des tags */}
          <div className="form-group">
            <label className="form-label">
              Thématiques & Tags <span className="required-mark">*</span>
            </label>
            
            {/* Tags déjà sélectionnés */}
            <div className="selected-tags-container">
              {selectedTags.map((tag) => (
                <span key={tag} className="selected-tag-chip">
                  #{tag}
                  <button
                    type="button"
                    className="remove-tag-btn"
                    onClick={() => handleRemoveTag(tag)}
                    title={`Supprimer le tag ${tag}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            {/* Suggestions de tags prédéfinis */}
            <div className="preset-tags-list">
              <span className="preset-label">Suggestions :</span>
              {PRESET_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`preset-tag-btn ${isSelected ? "selected" : ""}`}
                    onClick={() => togglePresetTag(tag)}
                  >
                    {isSelected ? "✓ " : "+ "}
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Ajout d'un tag personnalisé */}
            <div className="custom-tag-row">
              <input
                type="text"
                className="custom-tag-input"
                placeholder="Ajouter un tag personnalisé..."
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

          {/* Visibilité du canal (Public vs Privé) */}
          <div className="form-group">
            <label className="form-label">Visibilité d'accès</label>
            <div className="visibility-options-grid">
              {/* Option Public */}
              <label
                className={`visibility-card ${visibility === "public" ? "active" : ""}`}
                onClick={() => setVisibility("public")}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                />
                <div className="visibility-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <div className="visibility-text">
                  <div className="visibility-title">
                    <span>Public</span>
                    <span className="visibility-pill public">Libre</span>
                  </div>
                  <p>Accessible et visible immédiatement par tous les membres de la promo.</p>
                </div>
              </label>

              {/* Option Privée */}
              <label
                className={`visibility-card ${visibility === "private" ? "active" : ""}`}
                onClick={() => setVisibility("private")}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                />
                <div className="visibility-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div className="visibility-text">
                  <div className="visibility-title">
                    <span>Privé</span>
                    <span className="visibility-pill private">Sur invitation</span>
                  </div>
                  <p>Espace réservé accessible uniquement aux membres expressément invités.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Boutons d'action en bas de la modale */}
          <div className="modal-actions-footer">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="submit-create-btn"
            >
              Créer le canal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
