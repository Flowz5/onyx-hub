import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "./services/firebase";
import { AuthCard } from "./components/AuthCard";
import { OnyxLogo } from "./components/OnyxLogo";

// Composant racine de l'application Onyx Hub
function App() {
  // État de l'utilisateur Firebase connecté
  const [user, setUser] = useState<User | null>(null);

  // État d'attente de résolution initiale de la session Firebase
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  // Écoute en temps réel des changements d'état d'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitialLoading(false);
    });

    // Nettoyage de l'écouteur lors du démontage du composant
    return () => unsubscribe();
  }, []);

  // Déconnexion de la session Firebase de l'utilisateur
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  // Affichage d'un indicateur minimal pendant le chargement initial de la session
  if (initialLoading) {
    return (
      <div style={{ color: "#E5E5E5", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <OnyxLogo size={64} showHexHalo={false} />
        <span style={{ fontSize: "0.9rem", letterSpacing: "0.08em" }}>CHARGEMENT DE LA SESSION...</span>
      </div>
    );
  }

  // Affichage de la carte de connexion / inscription si l'utilisateur n'est pas connecté
  if (!user) {
    return <AuthCard />;
  }

  // Affichage de l'écran d'accueil temporaire une fois l'élève connecté
  return (
    <div className="authenticated-card">
      <div className="user-badge">
        <span>● ÉLÈVE CONNECTÉ</span>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <OnyxLogo size={80} showHexHalo={true} />
      </div>

      <h2>Bienvenue, {user.displayName || "Élève"} !</h2>
      <p>
        Compte actif : <strong>{user.email}</strong>
        <br />
        Vous êtes connecté à <strong>Onyx Hub</strong>. L'authentification Firebase est opérationnelle.
      </p>

      {/* Bouton de déconnexion */}
      <button type="button" className="signout-btn" onClick={handleSignOut}>
        SE DÉCONNECTER
      </button>
    </div>
  );
}

export default App;
