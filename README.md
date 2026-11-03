# Onyx Hub 🎓

Plateforme web d'entraide et d'assistance collaborative pour la classe, combinant un système de tickets d'assistance et un forum de type mini Stack Overflow.

## 🚀 Stack Technique

- **Front-end** : [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **BaaS (Backend as a Service)** : [Firebase](https://firebase.google.com/)
  - **Authentication** : Inscription / Connexion des élèves
  - **Cloud Firestore** : Base de données NoSQL temps réel (utilisateurs, canaux, tickets, posts, réponses, likes)
  - **Storage** : Pièces jointes et images
- **Hébergement & CI/CD** : [Vercel](https://vercel.com/)
- **Évolution future** : Application mobile (React Native / Flutter) consommant les mêmes services Firebase.

---

## 🛠️ Installation & Démarrage Local

1. **Cloner le projet**
   ```bash
   git clone https://github.com/Flowz5/onyx-hub.git
   cd onyx-hub
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Variables d'environnement**
   Copiez `.env.example` en `.env.local` et renseignez les identifiants Firebase :
   ```bash
   cp .env.example .env.local
   ```

4. **Lancer le serveur de développement**
   ```bash
   npm run dev
   ```

---

## 🌿 Règles de contribution Git

- La branche `main` est réservée aux versions stables de production (déployées sur Vercel).
- La branche `develop` sert à l'intégration des fonctionnalités.
- Toute nouvelle fonctionnalité est développée sur une branche dédiée : `feature/nom_de_la_feature`.
- Aucun push direct ou merge sur `main` / `develop` sans validation explicite.
