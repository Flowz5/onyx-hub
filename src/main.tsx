import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Importation des styles SCSS globaux et du composant racine
import './index.scss'
import App from './App.tsx'

// Montage de l'application React dans le nœud DOM racine
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
