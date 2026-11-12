import React, { useState } from "react";
import "./MemberEmailsInput.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { Mail, UserPlus, X } from "lucide-react";
import { MAX_CHANNEL_MEMBERS, isValidEmail, normalizeEmail } from "../types/channel";

interface MemberEmailsInputProps {
  // Liste courante des e-mails invités
  emails: string[];
  onChange: (emails: string[]) => void;
  // E-mail du créateur, exclu des invitations (il a déjà accès au canal)
  ownerEmail?: string | null;
  disabled?: boolean;
}

// Champ de saisie des membres d'un canal privé : ajout par e-mail et liste des invités
export const MemberEmailsInput: React.FC<MemberEmailsInputProps> = ({
  emails,
  onChange,
  ownerEmail,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  // Validation puis ajout d'une ou plusieurs adresses (séparées par virgule, point-virgule ou espace)
  const handleAddEmails = () => {
    const candidates = inputValue.split(/[\s,;]+/).map(normalizeEmail).filter(Boolean);
    if (candidates.length === 0) return;

    const invalid = candidates.filter((email) => !isValidEmail(email));
    if (invalid.length > 0) {
      setInputError(`Adresse invalide : ${invalid[0]}`);
      return;
    }

    if (ownerEmail && candidates.includes(normalizeEmail(ownerEmail))) {
      setInputError("Vous êtes le créateur du canal : votre accès est déjà garanti.");
      return;
    }

    const nextEmails = Array.from(new Set([...emails, ...candidates]));
    if (nextEmails.length > MAX_CHANNEL_MEMBERS) {
      setInputError(`Un canal privé accepte ${MAX_CHANNEL_MEMBERS} membres invités au maximum.`);
      return;
    }

    onChange(nextEmails);
    setInputValue("");
    setInputError(null);
  };

  // Retrait d'un membre de la liste des invités
  const handleRemoveEmail = (emailToRemove: string) => {
    onChange(emails.filter((email) => email !== emailToRemove));
  };

  return (
    <div className="member-emails-input-component">
      {/* Ligne de saisie d'une nouvelle adresse */}
      <div className="email-entry-row">
        <div className="email-input-wrapper">
          <Mail className="onyx-icon email-input-icon" size={15} strokeWidth={2} aria-hidden="true" />
          <input
            type="email"
            className="email-input"
            placeholder="adresse@exemple.fr"
            value={inputValue}
            disabled={disabled}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (inputError) setInputError(null);
            }}
            onKeyDown={(e) => {
              // La touche Entrée ajoute l'adresse sans soumettre le formulaire parent
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddEmails();
              }
            }}
            aria-label="Adresse e-mail du membre à inviter"
          />
        </div>
        <button
          type="button"
          className="add-member-btn"
          onClick={handleAddEmails}
          disabled={disabled || !inputValue.trim()}
        >
          <UserPlus className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
          Inviter
        </button>
      </div>

      {inputError && <p className="email-input-error">{inputError}</p>}

      {/* Liste des membres invités */}
      {emails.length > 0 ? (
        <ul className="member-chips-list">
          {emails.map((email) => (
            <li key={email} className="member-chip">
              <span className="member-email">{email}</span>
              <button
                type="button"
                className="remove-member-btn"
                onClick={() => handleRemoveEmail(email)}
                disabled={disabled}
                title={`Retirer ${email}`}
              >
                <X className="onyx-icon" size={12} strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-members-hint">
          Aucun membre invité pour l'instant : seul le créateur aura accès au canal.
        </p>
      )}

      <p className="members-counter">
        {emails.length} / {MAX_CHANNEL_MEMBERS} membres invités
      </p>
    </div>
  );
};
