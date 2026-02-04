# 🔒 Checklist de Sécurité et Déploiement

## 🚀 Déploiement aujourd'hui — À faire à la main

Avant de déployer, remplace ces 3 valeurs (une seule fois) :

| Fichier | Variable | À mettre |
|--------|----------|----------|
| `backend/.env` | `FRONTEND_URL` | L’URL de ton site en prod (ex. `https://snackin.vercel.app`) |
| `backend/.env` | `STRIPE_SECRET_KEY` | Ta clé secrète Stripe **Live** (`sk_live_...`) depuis [Stripe → Clés API](https://dashboard.stripe.com/apikeys) |
| `frontend/.env` | `VITE_API_BASE_URL` | L’URL de ton API en prod (ex. `https://ton-backend.railway.app/api`) |

Ensuite : build frontend, déployer backend puis frontend, et tester un paiement.

---

## ⚠️ PROBLÈMES CRITIQUES À CORRIGER AVANT DÉPLOIEMENT

### 1. 🔴 CRITIQUE - Secrets exposés
- [x] **CORRIGÉ** : `VITE_STRIPE_SECRET_KEY` supprimée du frontend (ne doit JAMAIS être dans le frontend)
- [x] **CORRIGÉ** : Changer `JWT_SECRET` dans `backend/.env` pour un vrai secret fort (minimum 32 caractères aléatoires)
- [x] **OK** : Vérifier que tous les fichiers `.env` sont dans `.gitignore`

### 2. 🔴 CRITIQUE - Clés Stripe en mode test
- [x] **OK** : Clé publique Stripe **PRODUCTION** configurée dans `frontend/.env`
- [ ] **À FAIRE** : Ajouter la clé secrète Stripe **PRODUCTION** (`sk_live_...`) dans `backend/.env` (STRIPE_SECRET_KEY) — à récupérer dans le dashboard Stripe, onglet « Clés API »
- [ ] **À FAIRE** : Tester les paiements avec les vraies cartes de test Stripe

### 3. 🟡 IMPORTANT - Configuration production
- [ ] **À FAIRE** : Changer `NODE_ENV=production` dans `backend/.env`
- [ ] **À FAIRE** : Mettre à jour `FRONTEND_URL` avec votre URL de production (ex: `https://snackin.com`)
- [ ] **À FAIRE** : Mettre à jour `VITE_API_BASE_URL` dans `frontend/.env` avec l'URL de votre API en production
- [ ] **À FAIRE** : Configurer HTTPS (SSL/TLS) pour votre domaine

### 4. 🟡 IMPORTANT - Base de données
- [ ] **À FAIRE** : Vérifier que la connexion MongoDB utilise une URL sécurisée avec authentification
- [ ] **À FAIRE** : Activer le backup automatique de MongoDB
- [ ] **À FAIRE** : Configurer les index MongoDB pour les performances

### 5. 🟡 IMPORTANT - Sécurité applicative
- [x] **OK** : Helmet configuré pour les headers de sécurité
- [x] **OK** : Rate limiting configuré (100 requêtes/15min)
- [x] **OK** : CORS configuré correctement
- [x] **OK** : Validation des entrées avec express-validator
- [x] **OK** : Mots de passe hashés avec bcrypt
- [x] **OK** : Validation de taille maximale pour les images base64 (galerie : 4 Mo, commentaires : 2 Mo/photo, max 5 photos)
- [ ] **À AMÉLIORER** : Ajouter une sanitization HTML pour les commentaires (prévenir XSS)

### 6. 🟢 BONNES PRATIQUES
- [x] **OK** : Variables d'environnement utilisées pour les secrets
- [x] **OK** : `.env` dans `.gitignore`
- [x] **OK** : Authentification JWT
- [x] **OK** : Middleware d'autorisation admin
- [ ] **À FAIRE** : Configurer des logs de sécurité (tentatives d'accès, erreurs)
- [x] **OK** : Monitoring des erreurs avec Sentry (optionnel : définir `SENTRY_DSN` dans `backend/.env`)

## 📋 Checklist Pré-Déploiement

### Backend
- [ ] Générer un nouveau `JWT_SECRET` fort (utiliser `openssl rand -base64 32`)
- [ ] Configurer les variables d'environnement de production
- [ ] Tester toutes les routes API
- [ ] Vérifier que les emails fonctionnent avec SMTP de production
- [ ] Configurer les variables Stripe de production
- [ ] Tester les paiements avec les cartes de test Stripe
- [ ] Vérifier que le rate limiting fonctionne
- [ ] Tester l'authentification admin

### Frontend
- [ ] Mettre à jour `VITE_API_BASE_URL` avec l'URL de production
- [ ] Mettre à jour `VITE_STRIPE_PUBLIC_KEY` avec la clé publique de production
- [ ] Vérifier que toutes les fonctionnalités fonctionnent
- [ ] Tester sur différents navigateurs
- [ ] Tester la responsivité mobile
- [ ] Optimiser les images
- [ ] Vérifier les performances (lighthouse)

### Infrastructure
- [ ] Configurer HTTPS/SSL
- [ ] Configurer un domaine personnalisé
- [ ] Configurer les variables d'environnement sur le serveur
- [ ] Configurer le monitoring
- [ ] Configurer les backups automatiques
- [ ] Configurer un processus de déploiement (CI/CD si possible)

## 🔐 Génération de Secrets Sécurisés

### JWT_SECRET
```bash
# Générer un secret fort (32 caractères)
openssl rand -base64 32
```

### Exemple de .env de production (backend)
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/snackin?retryWrites=true&w=majority
JWT_SECRET=<GÉNÉRER_UN_SECRET_FORT_32_CARACTÈRES>
JWT_EXPIRE=24h
FRONTEND_URL=https://votre-domaine.com
STRIPE_SECRET_KEY=sk_live_<VOTRE_CLÉ_PRODUCTION>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre_email@gmail.com
SMTP_PASSWORD=<VOTRE_APP_PASSWORD>
```

### Exemple de .env de production (frontend)
```env
VITE_STRIPE_PUBLIC_KEY=pk_live_<VOTRE_CLÉ_PUBLIQUE_PRODUCTION>
VITE_API_BASE_URL=https://api.votre-domaine.com/api
```

### Monitoring des erreurs (Sentry)
Le backend envoie les erreurs à Sentry si `SENTRY_DSN` est défini dans `backend/.env` :
1. Créez un compte sur [sentry.io](https://sentry.io) et un projet **Node / Express**.
2. Copiez le **DSN** du projet (ex. `https://xxx@xxx.ingest.sentry.io/xxx`).
3. Ajoutez dans `backend/.env` : `SENTRY_DSN=https://...`
4. En production, exécutez `npm install` puis redémarrez le serveur. Les erreurs non gérées seront visibles dans le dashboard Sentry.

## 🚀 Options de Déploiement

### Backend
- **Heroku** : Facile, gratuit pour commencer
- **Railway** : Simple, bon pour Node.js
- **DigitalOcean** : Plus de contrôle
- **AWS/Google Cloud** : Plus complexe mais très scalable

### Frontend
- **Vercel** : Excellent pour React, gratuit
- **Netlify** : Simple et gratuit
- **GitHub Pages** : Gratuit mais statique seulement
- **Même serveur que backend** : Serveur les fichiers statiques

## ⚠️ AVANT DE DÉPLOYER

1. **NE JAMAIS** commiter les fichiers `.env` dans Git
2. **TOUJOURS** utiliser HTTPS en production
3. **TOUJOURS** utiliser les clés Stripe de production (pas les clés test)
4. **TOUJOURS** générer un nouveau `JWT_SECRET` fort pour la production
5. **TOUJOURS** tester toutes les fonctionnalités avant de déployer
6. **TOUJOURS** configurer les backups de la base de données

## 📞 Support

En cas de problème lors du déploiement, vérifiez :
- Les logs du serveur backend
- Les logs du serveur frontend
- Les variables d'environnement sont bien configurées
- Les URLs sont correctes (pas de localhost en production)
