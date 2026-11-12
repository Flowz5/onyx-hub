import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "../services/firebase";
import { ensureUserProfile } from "../services/profileService";

interface AuthContextType {
  user: User | null;
  // Vrai tant que la session ou le profil Firestore de l'utilisateur sont en cours de vérification
  loading: boolean;
  signOutUser: () => Promise<void>;
}

// Création du contexte d'authentification
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOutUser: async () => {},
});

// Fournisseur du contexte d'authentification pour toute l'application
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Écoute des changements de session utilisateur Firebase.
  // Le profil public (users/{uid}) est créé avant l'accès aux pages, car les compteurs
  // de posts et de tickets y sont mis à jour à chaque publication.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        try {
          await ensureUserProfile(currentUser);
        } catch (error) {
          console.error("Erreur lors de la création du profil utilisateur :", error);
        }
      }
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Déconnexion de l'utilisateur actif
  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erreur lors de la déconnexion de l'utilisateur:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personnalisé pour consommer le contexte d'authentification
export const useAuth = () => useContext(AuthContext);
