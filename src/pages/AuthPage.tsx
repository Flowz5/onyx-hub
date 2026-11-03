import React from "react";
import { AuthCard } from "../components/AuthCard";
import "./AuthPage.scss";

// Page d'authentification enveloppant la carte de connexion et inscription
export const AuthPage: React.FC = () => {
  return (
    <div className="auth-page-layout">
      <AuthCard />
    </div>
  );
};
