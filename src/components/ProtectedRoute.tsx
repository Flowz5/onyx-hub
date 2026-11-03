import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { OnyxLogo } from "./OnyxLogo";

// Garde de navigation pour les routes réservées aux utilisateurs connectés
export const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth();

  // Affichage d'un écran d'attente pendant la vérification du statut d'authentification
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", color: "#E5E5E5" }}>
        <OnyxLogo size={64} showHexHalo={false} />
        <span style={{ fontSize: "0.85rem", letterSpacing: "0.1em" }}>CHARGEMENT DE LA SESSION...</span>
      </div>
    );
  }

  // Redirection automatique vers la page de connexion si aucune session active
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Rendu de la route protégée demandée
  return <Outlet />;
};
