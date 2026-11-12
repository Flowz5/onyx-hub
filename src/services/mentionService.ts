// =====================================================================
// SERVICE DES MENTIONS : CANDIDATS D'UN CANAL ET ANNUAIRE DES E-MAILS
// emailIndex/{email} associe l'e-mail d'un compte à son uid. Une entrée n'est lisible
// qu'en connaissant l'e-mail exact (lecture unitaire, liste interdite par les règles) :
// elle permet de retrouver les comptes des membres invités d'un canal privé.
// =====================================================================

import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import { normalizeEmail, type Channel } from "../types/channel";
import type { MentionCandidate } from "../types/mention";

const USERS_COLLECTION = "users";
const EMAIL_INDEX_COLLECTION = "emailIndex";

// Durée de conservation en mémoire de la liste complète des profils
const PROFILES_CACHE_DURATION_MS = 5 * 60 * 1000;

// Enregistrement (ou rafraîchissement) de l'entrée d'annuaire du compte connecté
export const registerEmailIndex = async (user: User): Promise<void> => {
  if (!user.email) return;
  await setDoc(doc(db, EMAIL_INDEX_COLLECTION, normalizeEmail(user.email)), { uid: user.uid });
};

// Cache de la liste complète des profils (canaux publics)
let allProfilesCache: { loadedAt: number; request: Promise<MentionCandidate[]> } | null = null;

const loadAllProfiles = (): Promise<MentionCandidate[]> => {
  if (allProfilesCache && Date.now() - allProfilesCache.loadedAt < PROFILES_CACHE_DURATION_MS) {
    return allProfilesCache.request;
  }
  const request = getDocs(collection(db, USERS_COLLECTION)).then((snapshot) =>
    snapshot.docs.map((d) => ({
      uid: d.id,
      displayName: d.data().displayName || "Étudiant",
      email: null,
    }))
  );
  allProfilesCache = { loadedAt: Date.now(), request };
  request.catch(() => {
    allProfilesCache = null;
  });
  return request;
};

// Profil d'un étudiant réduit au nom affiché (null s'il n'a pas de profil)
const loadCandidate = async (uid: string, email: string | null): Promise<MentionCandidate | null> => {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid));
  if (!snapshot.exists()) return null;
  return { uid, displayName: snapshot.data().displayName || "Étudiant", email };
};

// Étudiants mentionnables dans un canal, triés par nom, sans l'utilisateur courant :
// tous les profils pour un canal public ; le créateur et les invités pour un canal privé
export const loadMentionCandidates = async (
  channel: Channel,
  currentUserId: string
): Promise<MentionCandidate[]> => {
  let candidates: MentionCandidate[];

  if (channel.visibility === "public") {
    candidates = await loadAllProfiles();
  } else {
    const members = await Promise.all(
      channel.memberEmails.map(async (email) => {
        const entry = await getDoc(doc(db, EMAIL_INDEX_COLLECTION, email)).catch(() => null);
        const uid = entry?.exists() ? (entry.data().uid as string) : null;
        return uid ? loadCandidate(uid, email) : null;
      })
    );
    const creator = await loadCandidate(channel.creatorId, null);
    candidates = [creator, ...members].filter(
      (candidate): candidate is MentionCandidate => candidate !== null
    );
  }

  const unique = new Map(candidates.map((candidate) => [candidate.uid, candidate]));
  unique.delete(currentUserId);
  return Array.from(unique.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "fr", { sensitivity: "base" })
  );
};
