# API Snackin - Backend

## Configuration

### 1. Installer les dépendances

```bash
npm install
```

### 2. Créer le fichier .env

Créez un fichier `.env` à la racine du dossier `backend` avec le contenu suivant :

```
MONGODB_URI=mongodb+srv://AdminSnackin:VOTRE_MOT_DE_PASSE@cluster0.ys5cxaz.mongodb.net/?appName=Cluster0
JWT_SECRET=votre_secret_jwt_tres_securise
JWT_EXPIRE=24h
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Configuration email (pour l'envoi de confirmations de commande)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre_email@gmail.com
SMTP_PASSWORD=votre_mot_de_passe_application
```

**Important** : 
- Remplacez `VOTRE_MOT_DE_PASSE` par le mot de passe réel de votre utilisateur `AdminSnackin`
- Remplacez `votre_secret_jwt_tres_securise` par une chaîne aléatoire sécurisée pour JWT
- Si votre mot de passe contient des caractères spéciaux, encodez-les en URL (ex: `@` → `%40`)

**Configuration Email (optionnel mais recommandé)** :
- Pour Gmail : Créez un "Mot de passe d'application" dans votre compte Google (Paramètres > Sécurité > Validation en 2 étapes > Mots de passe des applications)
- Remplacez `votre_email@gmail.com` par votre adresse Gmail
- Remplacez `votre_mot_de_passe_application` par le mot de passe d'application généré
- Si vous n'configurez pas l'email, les commandes fonctionneront toujours mais aucun email ne sera envoyé

### 3. Démarrer le serveur

```bash
# Mode développement (avec rechargement automatique)
npm run dev

# Mode production
npm start
```

Le serveur sera accessible sur `http://localhost:5000`

### 4. Routes disponibles

- `GET /api/health` - Vérifier l'état de l'API
- `/api/auth` - Authentification (register, login, logout, me)
- `/api/users` - Gestion des utilisateurs
- `/api/biscuits` - Gestion des biscuits
- `/api/commandes` - Gestion des commandes
- `/api/commentaires` - Gestion des commentaires

### 5. Sécurité

Le fichier `.env` est déjà ajouté au `.gitignore` pour éviter de commiter vos informations sensibles.


