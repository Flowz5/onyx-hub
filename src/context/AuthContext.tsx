import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "../services/firebase";

interface AuthContextType {
  user: User | null;
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

  // Écoute des changements de session utilisateur Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
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
