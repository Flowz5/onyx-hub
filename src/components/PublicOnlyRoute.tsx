import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Garde de navigation pour rediriger un utilisateur déjà connecté vers les channels
export const PublicOnlyRoute: React.FC = () => {
  const { user, loading } = useAuth();

  // Ne pas rediriger avant que l'état Firebase soit résolu
  if (loading) {
    return null;
  }

  // Redirection automatique vers la liste des channels si l'utilisateur est déjà connecté
  if (user) {
    return <Navigate to="/channels" replace />;
  }

  // Rendu de la vue publique (ex: Login / Signup)
  return <Outlet />;
};
