// =====================================================================
// HOOK DE LECTURE DU PROFIL PUBLIC D'UN ÉTUDIANT
// S'appuie sur le cache partagé du service des profils (un écouteur par profil).
// =====================================================================

import { useCallback, useSyncExternalStore } from "react";
import { getCachedUserProfile, watchUserProfile } from "../services/profileService";
import type { UserProfile } from "../types/profile";

// Retourne le profil (undefined pendant le chargement, null s'il n'existe pas)
export const useUserProfile = (uid: string | null | undefined): UserProfile | null | undefined => {
  const subscribe = useCallback(
    (onChange: () => void) => (uid ? watchUserProfile(uid, onChange) : () => {}),
    [uid]
  );
  const getSnapshot = useCallback(() => (uid ? getCachedUserProfile(uid) : null), [uid]);
  return useSyncExternalStore(subscribe, getSnapshot);
};
