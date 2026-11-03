import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "../services/firebase";
import { OnyxLogo } from "../components/OnyxLogo";
import "./ResetPasswordPage.scss";

// Page personnalisée de réinitialisation de mot de passe avec validation du token oobCode
export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extraction du code de réinitialisation depuis les paramètres d'URL
  const oobCode = searchParams.get("oobCode");

  // États du formulaire
  const [accountEmail, setAccountEmail] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  // États de chargement et retours utilisateur
  const [verifyingCode, setVerifyingCode] = useState<boolean>(true);
  const [codeValid, setCodeValid] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Vérification de la validité du token à l'arrivée sur la page
  useEffect(() => {
    if (!oobCode) {
      setVerifyingCode(false);
      setCodeValid(false);
      setErrorMessage("Aucun code de réinitialisation détecté dans l'URL.");
      return;
    }

    const checkCode = async () => {
      try {
        // Validation du code auprès de Firebase et récupération de l'email associé
        const email = await verifyPasswordResetCode(auth, oobCode);
        setAccountEmail(email);
        setCodeValid(true);
      } catch (err) {
        console.error("Code de réinitialisation invalide ou expiré:", err);
        setCodeValid(false);
        setErrorMessage("Ce lien de réinitialisation est invalide ou a expiré. Veuillez refaire une demande.");
      } finally {
        setVerifyingCode(false);
      }
    };

    checkCode();
  }, [oobCode]);

  // Traitement de l'enregistrement du nouveau mot de passe
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Veuillez renseigner et confirmer votre mot de passe.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    if (!oobCode) return;

    setSubmitting(true);

    try {
      // Application définitive du nouveau mot de passe
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccessMessage("Votre mot de passe a été modifié avec succès ! Redirection vers la page de connexion...");
      setTimeout(() => navigate("/login"), 1800);
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === "auth/weak-password") {
        setErrorMessage("Le mot de passe choisi est trop faible (minimum 6 caractères).");
      } else {
        setErrorMessage("Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reset-password-layout">
      <div className="reset-password-card">
        {/* En-tête avec logo Onyx */}
        <div className="reset-card-header">
          <div className="reset-logo-wrapper">
            <OnyxLogo size={68} showHexHalo={false} />
          </div>
          <h1>Nouveau mot de passe</h1>
          {accountEmail && (
            <p className="reset-subtitle">
              Pour le compte : <strong>{accountEmail}</strong>
            </p>
          )}
        </div>

        {/* Vue 1 : Vérification initiale du lien en cours */}
        {verifyingCode && (
          <div className="reset-state-view">
            <h2>Vérification du lien...</h2>
            <p>Un instant, nous validons votre demande de sécurité.</p>
          </div>
        )}

        {/* Vue 2 : Lien invalide ou expiré */}
        {!verifyingCode && !codeValid && (
          <div className="reset-state-view">
            <div className="state-icon-box error">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h2>Lien invalide ou expiré</h2>
            <p>{errorMessage}</p>
            <button
              type="button"
              className="submit-btn"
              onClick={() => navigate("/login")}
            >
              RETOURNER À LA CONNEXION
            </button>
          </div>
        )}

        {/* Vue 3 : Formulaire actif de réinitialisation */}
        {!verifyingCode && codeValid && (
          <form className="reset-form" onSubmit={handleSubmit}>
            {/* Nouveau mot de passe */}
            <div className="input-group">
              <label htmlFor="newPassword">Nouveau mot de passe</label>
              <div className="input-field-wrapper">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Confirmation du mot de passe */}
            <div className="input-group">
              <label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</label>
              <div className="input-field-wrapper">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  required
                />
              </div>
            </div>

            {/* Messages d'erreur et de confirmation */}
            {errorMessage && (
              <div className="auth-message error" role="alert">
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="auth-message success" role="status">
                <span>{successMessage}</span>
              </div>
            )}

            {/* Actions de validation */}
            <div className="reset-actions">
              <button
                type="submit"
                className="submit-btn"
                disabled={submitting || Boolean(successMessage)}
              >
                {submitting ? "Enregistrement..." : "ENREGISTRER LE MOT DE PASSE"}
              </button>

              <button
                type="button"
                className="back-to-login-link"
                onClick={() => navigate("/login")}
              >
                Annuler et revenir à la connexion
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
