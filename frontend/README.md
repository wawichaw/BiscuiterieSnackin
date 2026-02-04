# 🍪 Frontend React - Snackin'

Frontend React complet pour l'application Snackin' avec le même design que la version Vue.js.

## 🚀 Installation

```bash
npm install
```

## ⚙️ Configuration

Copiez `.env.example` vers `.env` et configurez :

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## 🏃 Démarrer

**Mode développement :**
```bash
npm run dev
```

Le serveur sera disponible sur `http://localhost:3000`

**Build pour production :**
```bash
npm run build
```

## 📁 Structure

```
frontend/
├── src/
│   ├── components/      # Composants réutilisables
│   ├── contexts/        # Contextes React (Auth)
│   ├── pages/           # Pages principales
│   ├── services/        # Services API
│   ├── App.jsx          # Composant principal
│   └── main.jsx         # Point d'entrée
├── public/              # Assets statiques
└── package.json
```

## 🎨 Design

Le design est identique à la version Vue.js avec :
- Même palette de couleurs (rose/cherry)
- Même structure de navigation
- Même style de cartes et boutons
- Animations et transitions similaires

## 🔐 Authentification

L'authentification utilise JWT et est gérée via `AuthContext`.

## 📦 Fonctionnalités

- ✅ Page d'accueil
- ✅ Authentification (Login/Register)
- ✅ Liste des biscuits
- ✅ Détails d'un biscuit
- ✅ Commander
- ✅ Mes commandes
- ✅ Commentaires
- ✅ Dashboard admin
- ✅ Gestion biscuits (admin)
- ✅ Gestion commandes (admin)
- ✅ Gestion commentaires (admin)

