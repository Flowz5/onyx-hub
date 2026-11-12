import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { loadMentionCandidates } from "../services/mentionService";
import type { Channel } from "../types/channel";
import type { MentionCandidate } from "../types/mention";

// Étudiants mentionnables dans le canal affiché, partagés par tous les éditeurs de la page
const MentionContext = createContext<MentionCandidate[]>([]);

// Fournisseur des candidats aux mentions, chargés par la page du canal
export const MentionProvider: React.FC<{ candidates: MentionCandidate[]; children: React.ReactNode }> = ({
  candidates,
  children,
}) => <MentionContext.Provider value={candidates}>{children}</MentionContext.Provider>;

// Hook de lecture des candidats (liste vide hors d'un canal)
export const useMentionCandidates = () => useContext(MentionContext);

// Chargement des candidats aux mentions d'un canal (hors utilisateur courant)
export const useChannelMentionCandidates = (channel: Channel | null): MentionCandidate[] => {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  const userId = user?.uid;

  useEffect(() => {
    if (!channel || !userId) return;
    let isActive = true;
    loadMentionCandidates(channel, userId)
      .then((loaded) => {
        if (isActive) setCandidates(loaded);
      })
      .catch((error) => console.error("Erreur de chargement des membres mentionnables :", error));
    return () => {
      isActive = false;
    };
  }, [channel, userId]);

  return candidates;
};
