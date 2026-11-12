// =====================================================================
// MENTIONS D'ÉTUDIANTS DANS LES CONTENUS MARKDOWN
// Une mention est stockée sous forme de lien Markdown vers le profil : @[Nom](/profile/uid)
// =====================================================================

// Étudiant pouvant être mentionné dans le canal courant
export interface MentionCandidate {
  uid: string;
  displayName: string;
  // E-mail d'invitation, renseigné pour les membres d'un canal privé (vérifié par les règles Firestore)
  email: string | null;
}

// Destinataire d'une notification de mention
export interface MentionTarget {
  uid: string;
  email: string | null;
}

// Nombre maximal de personnes notifiées par contenu (limite des lectures des règles Firestore)
export const MAX_NOTIFIED_MENTIONS = 5;

// Préfixe des liens de profil utilisés par les mentions
export const PROFILE_LINK_PREFIX = "/profile/";

// Mention complète dans un contenu Markdown
const MENTION_PATTERN = /@\[([^\]]*)\]\(\/profile\/([A-Za-z0-9]+)\)/g;

// Écriture Markdown d'une mention (les crochets du nom sont retirés pour ne pas casser le lien)
export const formatMention = (displayName: string, uid: string): string =>
  `@[${displayName.replace(/[[\]]/g, "")}](${PROFILE_LINK_PREFIX}${uid})`;

// Destinataires des notifications : personnes mentionnées présentes parmi les candidats du canal,
// sans doublon, sans l'auteur lui-même ni les personnes exclues (ex : auteur du parent déjà notifié)
export const resolveMentionTargets = (
  content: string,
  candidates: MentionCandidate[],
  excludedUids: (string | null | undefined)[]
): MentionTarget[] => {
  const byUid = new Map(candidates.map((candidate) => [candidate.uid, candidate]));
  const targets = new Map<string, MentionTarget>();
  for (const match of content.matchAll(MENTION_PATTERN)) {
    const uid = match[2];
    const candidate = byUid.get(uid);
    if (!candidate || excludedUids.includes(uid) || targets.has(uid)) continue;
    targets.set(uid, { uid, email: candidate.email });
  }
  return Array.from(targets.values()).slice(0, MAX_NOTIFIED_MENTIONS);
};
