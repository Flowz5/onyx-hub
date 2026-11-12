import React, { useRef, useState } from "react";
import "./RichTextEditor.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { Code, Eye, ImagePlus, Link2, Loader2, PenLine, SquareCode } from "lucide-react";
import { useAuth } from "../context/AuthContext";
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

// Éditeur de texte enrichi au format Markdown : liens, images, code en ligne et blocs de code
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
        <textarea
          ref={textareaRef}
          id={id}
          className="editor-textarea"
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={ariaLabel}
          spellCheck
        />
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
