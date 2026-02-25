import './instrument.js';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import biscuitRoutes from './routes/biscuit.routes.js';
import commandeRoutes from './routes/commande.routes.js';
import commentaireRoutes from './routes/commentaire.routes.js';
import galerieRoutes from './routes/galerie.routes.js';
import horaireRoutes from './routes/horaire.routes.js';
import paiementRoutes from './routes/paiement.routes.js';
import tarifsRoutes from './routes/tarifs.routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Derrière un proxy (Render, etc.) : faire confiance à X-Forwarded-For pour le rate-limit et l'IP réelle
app.set('trust proxy', 1);

// Connexion à la base de données
connectDB();

// Middleware de sécurité
app.use(helmet());

// CORS - Autoriser le frontend
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const allowedOrigins = [
  frontendUrl,
  'https://biscuiteriesnackin.com', // Domaine de production
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173', // Vite par défaut
];
if (process.env.NODE_ENV === 'development') {
  // En dev, accepter tout localhost (n'importe quel port)
  allowedOrigins.push(/^http:\/\/localhost(:\d+)?$/);
}
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const o = origin.replace(/\/$/, '');
    const ok = allowedOrigins.some(allowed =>
      typeof allowed === 'string' ? o === allowed : allowed.test(origin)
    );
    callback(null, ok ? origin : false);
  },
  credentials: true,
}));

// Rate limiting général
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite de 100 requêtes par IP
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
  standardHeaders: true, // Retourne les headers RateLimit-* dans la réponse
  legacyHeaders: false, // Désactive les headers X-RateLimit-*
});

// Rate limiting strict pour les routes sensibles (auth, paiement)
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limite de 10 requêtes par IP pour les routes sensibles
  message: 'Trop de tentatives. Veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
app.use('/api/auth', strictLimiter); // Rate limiting strict pour l'authentification
app.use('/api/paiement', strictLimiter); // Rate limiting strict pour les paiements

// Middleware pour parser JSON (augmenter la limite pour les images en base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging (uniquement en développement)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API Snackin\' est en ligne',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/biscuits', biscuitRoutes);
app.use('/api/commandes', commandeRoutes);
app.use('/api/commentaires', commentaireRoutes);
app.use('/api/horaires', horaireRoutes);
app.use('/api/galerie', galerieRoutes);
app.use('/api/paiement', paiementRoutes);
app.use('/api/tarifs', tarifsRoutes);

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route non trouvée' 
  });
});

// Sentry : capture des erreurs Express (à placer avant tout middleware d'erreur)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Démarrer le serveur
const server = app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📡 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 API disponible sur: http://localhost:${PORT}/api`);
});

// Gestion de l'erreur de port déjà utilisé
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Erreur: Le port ${PORT} est déjà utilisé !`);
    console.error(`💡 Solutions possibles:`);
    console.error(`   1. Arrêter le processus qui utilise le port ${PORT}:`);
    console.error(`      netstat -ano | findstr :${PORT}`);
    console.error(`      taskkill /PID <PID> /F`);
    console.error(`   2. Utiliser un autre port en définissant PORT dans votre fichier .env`);
    console.error(`   3. Attendre quelques secondes si c'est une instance précédente qui se ferme\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

export default app;

