import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicOnlyRoute } from "./components/PublicOnlyRoute";
import { AuthPage } from "./pages/AuthPage";
import { ChannelsPage } from "./pages/ChannelsPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";

// Configuration du routeur principal de l'application
function App() {
  return (
    // Contexte global d'authentification Firebase
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Routes publiques réservées aux visiteurs non connectés */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<AuthPage />} />
          </Route>

          {/* Route personnalisée de réinitialisation de mot de passe */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Routes privées sécurisées nécessitant une authentification active */}
          <Route element={<ProtectedRoute />}>
            <Route path="/channels" element={<ChannelsPage />} />
          </Route>

          {/* Redirections automatiques des routes par défaut et inconnues */}
          <Route path="/" element={<Navigate to="/channels" replace />} />
          <Route path="*" element={<Navigate to="/channels" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
