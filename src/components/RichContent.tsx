import React, { useEffect, useState } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "./RichContent.scss";
// Icônes vectorielles Lucide, alignées sur la charte Black & Gold
import { Check, Copy, ImageOff } from "lucide-react";
import { Link } from "react-router-dom";
import { ONYX_IMAGE_PREFIX, getImageDataUrl } from "../services/imageService";
import { PROFILE_LINK_PREFIX } from "../types/mention";

interface RichContentProps {
  // Contenu au format Markdown (texte, liens, images, blocs de code)
  content: string;
  className?: string;
}

// Extraction récursive du texte brut d'un arbre d'éléments React (code coloré inclus)
const extractText = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
};

// Bloc de code avec en-tête (langage détecté) et bouton de copie
const CodeBlock: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [isCopied, setIsCopied] = useState(false);

  // Récupération du langage depuis la classe « language-xxx » de l'élément <code>
  const codeElement = React.Children.toArray(children)[0];
  const codeClassName = React.isValidElement<{ className?: string }>(codeElement)
    ? codeElement.props.className || ""
    : "";
  const language = /language-([\w+#-]+)/.exec(codeClassName)?.[1] || "texte";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(extractText(children).replace(/\n$/, ""));
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1800);
    } catch {
      // Copie indisponible (contexte non sécurisé) : aucune action supplémentaire
    }
  };

  return (
    <div className="rich-code-block">
      <div className="code-block-header">
        <span className="code-language">{language}</span>
        <button type="button" className="copy-code-btn" onClick={handleCopy}>
          {isCopied ? (
            <>
              <Check className="onyx-icon onyx-icon--leading" size={13} strokeWidth={2} aria-hidden="true" />
              Copié
            </>
          ) : (
            <>
              <Copy className="onyx-icon onyx-icon--leading" size={13} strokeWidth={2} aria-hidden="true" />
              Copier
            </>
          )}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
};

// Image interne stockée dans Firestore, chargée à l'affichage
const StoredImage: React.FC<{ imageId: string; alt: string }> = ({ imageId, alt }) => {
  // undefined : chargement en cours ; null : image introuvable ou inaccessible
  const [dataUrl, setDataUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let isActive = true;
    getImageDataUrl(imageId).then((result) => {
      if (isActive) setDataUrl(result);
    });
    return () => {
      isActive = false;
    };
  }, [imageId]);

  if (dataUrl === undefined) {
    return <span className="rich-image-placeholder">Chargement de l'image...</span>;
  }
  if (dataUrl === null) {
    return (
      <span className="rich-image-placeholder">
        <ImageOff className="onyx-icon onyx-icon--leading" size={14} strokeWidth={2} aria-hidden="true" />
        Image indisponible
      </span>
    );
  }
  return (
    <a href={dataUrl} target="_blank" rel="noopener noreferrer" className="rich-image-link">
      <img src={dataUrl} alt={alt} loading="lazy" />
    </a>
  );
};

// Autorisation du protocole interne « onyx-image: » en plus des protocoles sûrs par défaut
const urlTransform = (url: string): string =>
  url.startsWith(ONYX_IMAGE_PREFIX) ? url : defaultUrlTransform(url);

// Personnalisation du rendu des éléments Markdown
const markdownComponents: Components = {
  // Mentions : pastille menant au profil, dans l'application ;
  // autres liens ouverts dans un nouvel onglet, sans transmission du contexte de la page
  a: ({ href, children }) =>
    href?.startsWith(PROFILE_LINK_PREFIX) ? (
      <Link to={href} className="rich-mention" onClick={(e) => e.stopPropagation()}>
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    ),
  // Images chargées à la demande, cliquables pour un affichage en taille réelle
  img: ({ src, alt }) =>
    typeof src === "string" && src.startsWith(ONYX_IMAGE_PREFIX) ? (
      <StoredImage imageId={src.slice(ONYX_IMAGE_PREFIX.length)} alt={alt || "Image partagée"} />
    ) : typeof src === "string" && src ? (
      <a href={src} target="_blank" rel="noopener noreferrer" className="rich-image-link">
        <img src={src} alt={alt || "Image partagée"} loading="lazy" />
      </a>
    ) : null,
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
};

// Le « @ » d'une mention est intégré au lien pour être affiché dans la pastille : @[Nom](...) → [@Nom](...)
const withMentionLinks = (content: string): string =>
  content.replace(/@\[([^\]]*)\]\((\/profile\/[A-Za-z0-9]+)\)/g, "[@$1]($2)");

// Affichage sécurisé d'un contenu Markdown : le HTML brut n'est jamais interprété
export const RichContent: React.FC<RichContentProps> = ({ content, className = "" }) => {
  return (
    <div className={`rich-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
        components={markdownComponents}
        urlTransform={urlTransform}
      >
        {withMentionLinks(content)}
      </ReactMarkdown>
    </div>
  );
};
