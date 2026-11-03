import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { OnyxLogo } from "./OnyxLogo";

// Composant principal de la page d'authentification (Connexion & Inscription)
export const AuthCard: React.FC = () => {
  const navigate = useNavigate();

  // Gestion de l'état de l'onglet actif (signin ou signup)
  const [isSignUp, setIsSignUp] = useState<boolean>(false);

  // États des champs du formulaire
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  // États de chargement et de retour utilisateur
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // État de la modale de réinitialisation de mot de passe
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>("");
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);
  const [forgotMessage, setForgotMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Traduction des codes d'erreur Firebase en messages explicites
  const formatFirebaseError = (code: string): string => {
    switch (code) {
      case "auth/email-already-in-use":
        return "Cette adresse email est déjà associée à un compte.";
      case "auth/invalid-email":
        return "L'adresse email saisie est invalide.";
      case "auth/operation-not-allowed":
        return "L'authentification par email/mot de passe n'est pas encore activée sur la console Firebase.";
      case "auth/weak-password":
        return "Le mot de passe doit comporter au moins 6 caractères.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Identifiants incorrects. Veuillez vérifier votre email et mot de passe.";
      case "auth/too-many-requests":
        return "Trop de tentatives infructueuses. Veuillez patienter avant de réessayer.";
      default:
        return "Une erreur inattendue est survenue. Veuillez vérifier vos informations ou réessayer.";
    }
  };

  // Traitement de la soumission du formulaire d'authentification
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation des champs obligatoires
    if (!email.trim() || !password) {
      setErrorMessage("Veuillez renseigner tous les champs obligatoires.");
      return;
    }

    if (isSignUp) {
      if (!displayName.trim()) {
        setErrorMessage("Veuillez renseigner votre nom ou pseudo.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Les deux mots de passe ne correspondent pas.");
        return;
      }
      if (password.length < 6) {
        setErrorMessage("Le mot de passe doit comporter au moins 6 caractères.");
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Création du compte utilisateur dans Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        // Mise à jour du profil utilisateur avec son nom/pseudo
        await updateProfile(user, {
          displayName: displayName.trim(),
        });

        // Enregistrement du profil dans la collection Firestore "users"
        try {
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            displayName: displayName.trim(),
            email: user.email,
            createdAt: serverTimestamp(),
            role: "student",
          });
        } catch (firestoreError) {
          console.warn("Écriture du document utilisateur Firestore différée:", firestoreError);
        }

        setSuccessMessage("Compte créé avec succès ! Redirection en cours...");
        setTimeout(() => navigate("/channels"), 800);
      } else {
        // Connexion de l'utilisateur existant
        await signInWithEmailAndPassword(auth, email.trim(), password);
        setSuccessMessage("Connexion réussie ! Redirection en cours...");
        setTimeout(() => navigate("/channels"), 500);
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      setErrorMessage(formatFirebaseError(error.code || ""));
    } finally {
      setLoading(false);
    }
  };

  // Envoi de l'email de réinitialisation de mot de passe
  const handleSendResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = forgotEmail.trim() || email.trim();

    if (!targetEmail) {
      setForgotMessage({
        type: "error",
        text: "Veuillez renseigner votre adresse email pour recevoir le lien.",
      });
      return;
    }

    setForgotLoading(true);
    setForgotMessage(null);

    try {
      // Configuration de redirection vers notre interface personnalisée Onyx Hub
      const actionCodeSettings = {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      };

      await sendPasswordResetEmail(auth, targetEmail, actionCodeSettings);
      setForgotMessage({
        type: "success",
        text: `Un email avec les instructions a été envoyé à ${targetEmail}. Pensez à vérifier vos spams.`,
      });
    } catch (err: unknown) {
      const error = err as { code?: string };
      setForgotMessage({
        type: "error",
        text: formatFirebaseError(error.code || ""),
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      {/* Colonne gauche : Formulaire d'authentification */}
      <div className="auth-form-column">
        <div>
          {/* Entête du formulaire */}
          <div className="auth-header">
            <h1 className="auth-title">
              {isSignUp ? "Créer un compte" : "Get Started"}
            </h1>
            <p className="auth-subtitle">
              {isSignUp
                ? "Rejoignez l'espace d'entraide et de partage"
                : "Connectez-vous pour accéder aux channels et tickets"}
            </p>
          </div>

          {/* Onglets de sélection du mode (Connexion / Inscription) */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab-btn ${!isSignUp ? "active" : ""}`}
              onClick={() => {
                setIsSignUp(false);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              Connexion
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${isSignUp ? "active" : ""}`}
              onClick={() => {
                setIsSignUp(true);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              Inscription
            </button>
          </div>

          {/* Formulaire de saisie des identifiants */}
          <form className="auth-form" onSubmit={handleSubmit}>
            {/* Champ Pseudo (uniquement lors de l'inscription) */}
            {isSignUp && (
              <div className="input-group">
                <label htmlFor="displayName">Nom ou Pseudo</label>
                <div className="input-field-wrapper">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </span>
                  <input
                    id="displayName"
                    type="text"
                    placeholder="Ex: Lucas Dupont"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                    required={isSignUp}
                  />
                </div>
              </div>
            )}

            {/* Champ Adresse Email */}
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <div className="input-field-wrapper">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                  </svg>
                </span>
                <input
                  id="email"
                  type="email"
                  placeholder="exemple@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            <div className="input-group">
              <label htmlFor="password">Mot de passe</label>
              <div className="input-field-wrapper">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                />
              </div>
            </div>

            {/* Champ Confirmation du mot de passe (uniquement lors de l'inscription) */}
            {isSignUp && (
              <div className="input-group">
                <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
                <div className="input-field-wrapper">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      <path d="m10 16 2 2 4-4"></path>
                    </svg>
                  </span>
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required={isSignUp}
                  />
                </div>
              </div>
            )}

            {/* Notifications de statut (erreur ou confirmation) */}
            {errorMessage && (
              <div className="auth-message error" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="auth-message success" role="status">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>{successMessage}</span>
              </div>
            )}

            {/* Ligne d'actions (Lien mot de passe oublié + Bouton de soumission) */}
            <div className="auth-actions-row">
              {!isSignUp ? (
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotMessage(null);
                    setShowForgotModal(true);
                  }}
                  disabled={loading}
                >
                  Mot de passe oublié ?
                </button>
              ) : (
                <div />
              )}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <span>Patientez...</span>
                ) : isSignUp ? (
                  "S'INSCRIRE"
                ) : (
                  "SIGN IN"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Pied de formulaire avec bascule rapide */}
        <div className="auth-footer-note">
          {isSignUp ? (
            <p>
              Vous avez déjà un compte ?{" "}
              <a
                role="button"
                tabIndex={0}
                onClick={() => {
                  setIsSignUp(false);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
              >
                Connectez-vous
              </a>
            </p>
          ) : (
            <p>
              Pas encore de compte ?{" "}
              <a
                role="button"
                tabIndex={0}
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
              >
                Inscrivez-vous ici
              </a>
            </p>
          )}
        </div>
      </div>

      {/* Colonne droite : Hero branded inspiré de la maquette fournie */}
      <div className="auth-hero-column">
        {/* En-tête supérieur du hero */}
        <div className="hero-eyebrow">WELCOME TO</div>

        {/* Cœur central : Logo Onyx, nom et baseline */}
        <div className="hero-content">
          <div className="hero-logo-box">
            <OnyxLogo size={110} showHexHalo={true} />
          </div>
          <h2 className="hero-brand-name">
            ONYX <span>HUB</span>
          </h2>
          <p className="hero-tagline">
            L'espace centralisé d'entraide, de tickets d'assistance et d'échanges collaboratifs ouvert à tous.
          </p>
        </div>

        {/* Mentions discrètes de bas de carte */}
        <div className="hero-footer-credits">
          <span>PAR LÉO DUPONT</span>
          <span className="credit-separator" />
          <span>ÉTUDIANT EN BTS SIO</span>
        </div>
      </div>

      {/* Modale interactive de réinitialisation de mot de passe */}
      {showForgotModal && (
        <div className="modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-with-badge">
                <div className="modal-icon-badge">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="15" r="4"></circle>
                    <path d="m10.85 12.15 7.65-7.65a1 1 0 0 1 1.41 0l2.54 2.54a1 1 0 0 1 0 1.41l-2.05 2.05"></path>
                    <path d="m14 8 2 2"></path>
                  </svg>
                </div>
                <h3>Réinitialiser le mot de passe</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowForgotModal(false)}
                title="Fermer"
              >
                ✕
              </button>
            </div>

            <p className="modal-description">
              Saisissez l'adresse email associée à votre compte pour recevoir immédiatement un lien officiel et sécurisé de réinitialisation.
            </p>

            <form onSubmit={handleSendResetPassword}>
              <div className="input-group" style={{ marginBottom: "1rem" }}>
                <label htmlFor="forgotEmail">Votre adresse email</label>
                <div className="input-field-wrapper">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                    </svg>
                  </span>
                  <input
                    id="forgotEmail"
                    type="email"
                    placeholder="exemple@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {forgotMessage && (
                <div className={`auth-message ${forgotMessage.type}`} style={{ marginBottom: "1rem" }}>
                  <span>{forgotMessage.text}</span>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setShowForgotModal(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? "Envoi en cours..." : "ENVOYER LE LIEN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
