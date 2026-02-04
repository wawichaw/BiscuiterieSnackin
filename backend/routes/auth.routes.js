import express from 'express';
import { body, validationResult } from 'express-validator';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.model.js';
import Commande from '../models/Commande.model.js';
import { generateToken } from '../config/jwt.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { verifyRecaptcha } from '../middleware/recaptcha.middleware.js';

const router = express.Router();

// Initialiser le client Google OAuth
const googleClient = process.env.GOOGLE_CLIENT_ID 
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

// @route   POST /api/auth/register
// @desc    Enregistrer un nouvel utilisateur
// @access  Public
router.post('/register', [
  verifyRecaptcha(0.5), // Score minimum 0.5
  body('name').trim().notEmpty().withMessage('Le nom est requis'),
  body('email').isEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères'),
  body('password_confirmation').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Les mots de passe ne correspondent pas');
    }
    return true;
  }),
], async (req, res) => {
  try {
    // Vérifier les erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation',
        errors: errors.array(),
      });
    }

    const { name, email, password, role, isAdmin } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé',
      });
    }

    // En développement, permettre la création d'admin directement
    // En production, forcer user et isAdmin: false pour la sécurité
    const finalRole = (process.env.NODE_ENV === 'development' && role) ? role : 'user';
    const finalIsAdmin = (process.env.NODE_ENV === 'development' && isAdmin !== undefined) ? isAdmin : false;

    // Créer l'utilisateur
    const user = await User.create({
      name,
      email,
      password,
      role: finalRole,
      isAdmin: finalIsAdmin,
    });

    // Lier les commandes passées en invité avec ce même email au nouveau compte
    const emailLower = email.trim().toLowerCase();
    const linked = await Commande.updateMany(
      { user: null, visiteurEmail: { $regex: new RegExp(`^${emailLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      { $set: { user: user._id } }
    );
    if (linked.modifiedCount > 0) {
      console.log(`✅ ${linked.modifiedCount} commande(s) invité liée(s) au compte ${email}`);
    }

    // Générer le token
    const token = generateToken(user._id);

    // Retourner les données (sans le mot de passe)
    const userData = user.toObject();
    delete userData.password;

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: {
        token,
        user: userData,
      },
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur lors de l\'enregistrement',
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message,
        stack: error.stack 
      }),
    });
  }
});

// @route   POST /api/auth/login
// @desc    Connecter un utilisateur
// @access  Public
router.post('/login', [
  verifyRecaptcha(0.5), // Score minimum 0.5
  body('email').isEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Le mot de passe est requis'),
], async (req, res) => {
  try {
    // Vérifier les erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Trouver l'utilisateur avec le mot de passe
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect',
      });
    }

    // Vérifier si l'utilisateur est un utilisateur Google uniquement
    if (user.googleId && !user.password) {
      return res.status(401).json({
        success: false,
        message: 'Ce compte utilise la connexion Google. Veuillez vous connecter avec Google.',
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect',
      });
    }

    // Générer le token
    const token = generateToken(user._id);

    // Retourner les données (sans le mot de passe)
    const userData = user.toObject();
    delete userData.password;

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        token,
        user: userData,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion',
    });
  }
});

// @route   GET /api/auth/me
// @desc    Obtenir les informations de l'utilisateur connecté
// @access  Private
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    const userData = user.toObject();
    delete userData.password;

    res.json({
      success: true,
      data: { user: userData },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   POST /api/auth/google
// @desc    Se connecter ou s'inscrire avec Google
// @access  Public
router.post('/google', [
  body('credential').notEmpty().withMessage('Le token Google est requis'),
], async (req, res) => {
  try {
    if (!googleClient) {
      return res.status(500).json({
        success: false,
        message: 'Google OAuth non configuré. Vérifiez GOOGLE_CLIENT_ID dans .env',
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation',
        errors: errors.array(),
      });
    }

    const { credential } = req.body;

    // Vérifier le token Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email Google non disponible',
      });
    }

    // Chercher un utilisateur existant par email ou googleId
    let user = await User.findOne({
      $or: [
        { email },
        { googleId },
      ],
    });

    if (user) {
      // Si l'utilisateur existe mais n'a pas de googleId, l'ajouter
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Créer un nouvel utilisateur
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        googleId,
        password: undefined, // Pas de mot de passe pour les utilisateurs Google
      });
      // Lier les commandes passées en invité avec ce même email au nouveau compte
      const emailLower = email.trim().toLowerCase();
      const linked = await Commande.updateMany(
        { user: null, visiteurEmail: { $regex: new RegExp(`^${emailLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { $set: { user: user._id } }
      );
      if (linked.modifiedCount > 0) {
        console.log(`✅ ${linked.modifiedCount} commande(s) invité liée(s) au compte Google ${email}`);
      }
    }

    // Générer le token JWT
    const token = generateToken(user._id);

    // Retourner les données (sans le mot de passe)
    const userData = user.toObject();
    delete userData.password;

    res.json({
      success: true,
      message: 'Connexion Google réussie',
      data: {
        token,
        user: userData,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la connexion Google:', error);
    
    if (error.message && error.message.includes('Token used too early')) {
      return res.status(400).json({
        success: false,
        message: 'Token Google invalide ou expiré',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion Google',
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message 
      }),
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Déconnecter un utilisateur (côté client, on supprime juste le token)
// @access  Private
router.post('/logout', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Déconnexion réussie',
  });
});

export default router;

