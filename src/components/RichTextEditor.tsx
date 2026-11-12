import React, { useMemo, useRef, useState } from "react";
import "./RichTextEditor.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { AtSign, Code, Eye, ImagePlus, Link2, Loader2, PenLine, SquareCode } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useMentionCandidates } from "../context/MentionContext";
import { formatMention } from "../types/mention";
import { UserAvatar } from "./UserAvatar";
import { ACCEPTED_IMAGE_TYPES, uploadImage } from "../services/imageService";
import { RichContent } from "./RichContent";

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  // Raccourcis clavier propres au parent (ex : Ctrl + Entrée pour envoyer)
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  ariaLabel?: string;
}

// Langages proposés pour les blocs de code
const CODE_LANGUAGES = [
  "javascript",
  "typescript",
  "html",
  "css",
  "php",
  "python",
  "java",
  "csharp",
  "sql",
  "bash",
  "json",
];

// Nombre maximal de suggestions affichées lors d'une mention
const MAX_MENTION_SUGGESTIONS = 6;

// Saisie d'une mention en cours juste avant le curseur : « @ » suivi de quelques caractères
const PENDING_MENTION_PATTERN = /(?:^|\s)@([^\s@[\]()]{0,30})$/;

// Normalisation pour une recherche insensible à la casse et aux accents
const normalizeForSearch = (text: string): string =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Éditeur de texte enrichi au format Markdown : liens, images, code en ligne, blocs de code et mentions
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  id,
  value,
  onChange,
  placeholder,
  rows = 5,
  maxLength,
  disabled = false,
  onKeyDown,
  ariaLabel,
}) => {
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"write" | "preview">("write");
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Mention en cours de saisie : position du « @ » et texte tapé après lui
  const mentionCandidates = useMentionCandidates();
  const [pendingMention, setPendingMention] = useState<{ start: number; query: string } | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  const mentionSuggestions = useMemo(() => {
    if (!pendingMention) return [];
    const query = normalizeForSearch(pendingMention.query);
    return mentionCandidates
      .filter((candidate) => normalizeForSearch(candidate.displayName).includes(query))
      .slice(0, MAX_MENTION_SUGGESTIONS);
  }, [pendingMention, mentionCandidates]);

  const isMentionMenuOpen = pendingMention !== null && mentionSuggestions.length > 0;

  // Détection d'une mention en cours à partir du texte situé avant le curseur
  const detectPendingMention = (text: string, caret: number) => {
    if (mentionCandidates.length === 0) return;
    const match = PENDING_MENTION_PATTERN.exec(text.slice(0, caret));
    if (match) {
      setPendingMention({ start: caret - match[1].length - 1, query: match[1] });
      setActiveSuggestion(0);
    } else {
      setPendingMention(null);
    }
  };

  // Remplacement de « @texte » par la mention complète du candidat choisi
  const selectMention = (candidateIndex: number) => {
    const candidate = mentionSuggestions[candidateIndex];
    const textarea = textareaRef.current;
    if (!candidate || !pendingMention || !textarea) return;
    const caret = textarea.selectionStart;
    const mention = `${formatMention(candidate.displayName, candidate.uid)} `;
    const nextValue = value.slice(0, pendingMention.start) + mention + value.slice(caret);
    if (maxLength && nextValue.length > maxLength) return;
    onChange(nextValue);
    setPendingMention(null);

    const nextCaret = pendingMention.start + mention.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  };

  // Navigation clavier dans les suggestions, sinon raccourcis du parent
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMentionMenuOpen && !e.ctrlKey && !e.metaKey) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActiveSuggestion(
          (index) => (index + step + mentionSuggestions.length) % mentionSuggestions.length
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(activeSuggestion);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setPendingMention(null);
        return;
      }
    }
    onKeyDown?.(e);
  };

  // Insertion d'un fragment à la position du curseur, en entourant l'éventuelle sélection.
  // La zone sélectionnée après insertion correspond au texte à compléter par l'utilisateur.
  const insertAtCursor = (before: string, after = "", fallback = "") => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || fallback;
    const nextValue = value.slice(0, start) + before + selected + after + value.slice(end);

    if (maxLength && nextValue.length > maxLength) return;
    onChange(nextValue);

    // Repositionnement du curseur une fois la valeur mise à jour par React
    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  // Ajout d'un saut de ligne avant un bloc si le curseur n'est pas en début de ligne
  const blockPrefix = () => {
    const start = textareaRef.current?.selectionStart ?? value.length;
    return start > 0 && value[start - 1] !== "\n" ? "\n" : "";
  };

  const handleInsertLink = () => insertAtCursor("[", "](https://)", "texte du lien");

  const handleInsertInlineCode = () => insertAtCursor("`", "`", "code");

  // Insertion d'un « @ » ouvrant la liste des personnes mentionnables
  const handleInsertMention = () => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const prefix = start > 0 && !/\s/.test(value[start - 1]) ? " @" : "@";
    const nextValue = value.slice(0, start) + prefix + value.slice(textarea?.selectionEnd ?? start);
    if (maxLength && nextValue.length > maxLength) return;
    onChange(nextValue);
    const caret = start + prefix.length;
    setPendingMention({ start: caret - 1, query: "" });
    setActiveSuggestion(0);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(caret, caret);
    });
  };

  const handleInsertCodeBlock = () =>
    insertAtCursor(`${blockPrefix()}\`\`\`${codeLanguage}\n`, "\n```\n", "// votre code ici");

  // Compression et enregistrement de l'image dans Firestore, puis insertion de sa référence Markdown
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const url = await uploadImage(file, user.uid);
      const altText = file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "");
      insertAtCursor(`${blockPrefix()}![${altText}](${url})\n`);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'image :", error);
      // Les erreurs de validation locales sont affichées telles quelles ;
      // les erreurs Firebase (porteuses d'un code) reçoivent un message générique.
      const isValidationError = error instanceof Error && !("code" in error);
      setUploadError(
        isValidationError
          ? error.message
          : "L'envoi de l'image a échoué. Vous pouvez aussi coller un lien : ![description](https://...)"
      )
    } finally {
      setIsUploading(false);
    }
  };

  const isToolbarDisabled = disabled || mode === "preview";

  return (
    <div className={`rich-text-editor-component ${disabled ? "disabled" : ""}`}>
      {/* Barre d'outils : onglets Écrire / Aperçu et outils d'insertion */}
      <div className="editor-toolbar">
        <div className="editor-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "write"}
            className={`editor-tab ${mode === "write" ? "active" : ""}`}
            onClick={() => setMode("write")}
          >
            <PenLine className="onyx-icon onyx-icon--leading" size={13} strokeWidth={2} aria-hidden="true" />
            Écrire
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            className={`editor-tab ${mode === "preview" ? "active" : ""}`}
            onClick={() => setMode("preview")}
          >
            <Eye className="onyx-icon onyx-icon--leading" size={13} strokeWidth={2} aria-hidden="true" />
            Aperçu
          </button>
        </div>

        <div className="editor-tools">
          <button
            type="button"
            className="tool-btn"
            onClick={handleInsertLink}
            disabled={isToolbarDisabled}
            title="Insérer un lien"
            aria-label="Insérer un lien"
          >
            <Link2 className="onyx-icon" size={15} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isToolbarDisabled || isUploading}
            title="Insérer une image (compressée automatiquement)"
            aria-label="Insérer une image"
          >
            {isUploading ? (
              <Loader2 className="onyx-icon spin" size={15} strokeWidth={2} aria-hidden="true" />
            ) : (
              <ImagePlus className="onyx-icon" size={15} strokeWidth={2} aria-hidden="true" />
            )}
          </button>
          {mentionCandidates.length > 0 && (
            <button
              type="button"
              className="tool-btn"
              onClick={handleInsertMention}
              disabled={isToolbarDisabled}
              title="Mentionner un membre du canal"
              aria-label="Mentionner un membre du canal"
            >
              <AtSign className="onyx-icon" size={15} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="tool-btn"
            onClick={handleInsertInlineCode}
            disabled={isToolbarDisabled}
            title="Code en ligne"
            aria-label="Insérer du code en ligne"
          >
            <Code className="onyx-icon" size={15} strokeWidth={2} aria-hidden="true" />
          </button>

          {/* Bloc de code : choix du langage puis insertion */}
          <div className="code-block-tool">
            <select
              className="language-select"
              value={codeLanguage}
              onChange={(e) => setCodeLanguage(e.target.value)}
              disabled={isToolbarDisabled}
              aria-label="Langage du bloc de code"
            >
              {CODE_LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="tool-btn code-block-btn"
              onClick={handleInsertCodeBlock}
              disabled={isToolbarDisabled}
              title="Insérer un bloc de code"
            >
              <SquareCode className="onyx-icon onyx-icon--leading" size={15} strokeWidth={2} aria-hidden="true" />
              Bloc de code
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            onChange={handleImageSelected}
            hidden
          />
        </div>
      </div>

      {/* Zone d'écriture ou aperçu du rendu final */}
      {mode === "write" ? (
        <div className="editor-write-area">
          <textarea
            ref={textareaRef}
            id={id}
            className="editor-textarea"
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              onChange(e.target.value);
              detectPendingMention(e.target.value, e.target.selectionStart);
            }}
            onKeyDown={handleTextareaKeyDown}
            onClick={(e) => detectPendingMention(value, e.currentTarget.selectionStart)}
            onBlur={() => setPendingMention(null)}
            aria-label={ariaLabel}
            aria-autocomplete="list"
            aria-expanded={isMentionMenuOpen}
            spellCheck
          />

          {/* Suggestions de mention : membres du canal correspondant au texte tapé après « @ » */}
          {isMentionMenuOpen && (
            <ul className="mention-suggestions" role="listbox" aria-label="Membres à mentionner">
              {mentionSuggestions.map((candidate, index) => (
                <li
                  key={candidate.uid}
                  role="option"
                  aria-selected={index === activeSuggestion}
                  className={index === activeSuggestion ? "active" : ""}
                  // mousedown plutôt que click : la sélection précède la perte du focus
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectMention(index);
                  }}
                  onMouseEnter={() => setActiveSuggestion(index)}
                >
                  <UserAvatar uid={candidate.uid} fallbackName={candidate.displayName} size={24} />
                  <span>{candidate.displayName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="editor-preview" style={{ minHeight: `${rows * 1.6 + 1.5}rem` }}>
          {value.trim() ? (
            <RichContent content={value} />
          ) : (
            <p className="preview-empty">Rien à prévisualiser pour l'instant.</p>
          )}
        </div>
      )}

      {/* Aide à la syntaxe et erreurs d'envoi */}
      <div className="editor-footer">
        {uploadError ? (
          <span className="editor-error">{uploadError}</span>
        ) : (
          <span className="editor-hint">
            Markdown pris en charge : **gras**, `code`, [lien](url), ```bloc de code```
            {mentionCandidates.length > 0 && ", @ pour mentionner"}
          </span>
        )}
        {maxLength && (
          <span className="editor-counter">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
};
