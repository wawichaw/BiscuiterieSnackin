import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';
import User from '../models/User.model.js';
import crypto from 'crypto';

const router = express.Router();

// Fonction pour générer un mot de passe temporaire
const generateTemporaryPassword = () => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Toutes les routes nécessitent une authentification
router.use(authenticate);

const sansMotDePasse = (user) => {
  const data = user.toObject ? user.toObject() : { ...user };
  delete data.password;
  delete data.resetPasswordToken;
  delete data.resetPasswordExpires;
  delete data.temporaryPassword;
  delete data.temporaryPasswordExpires;
  return data;
};

// @route   GET /api/users
// @desc    Obtenir tous les utilisateurs (admin seulement)
// @access  Private/Admin
router.get('/', isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({
      success: true,
      count: users.length,
      data: { users },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   GET /api/users/assistants
// @desc    Lister les comptes assistant
// @access  Private/Admin
router.get('/assistants', isAdmin, async (req, res) => {
  try {
    const assistants = await User.find({ role: 'assistant' }).select('-password').sort({ createdAt: -1 });
    res.json({
      success: true,
      count: assistants.length,
      data: { assistants },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   POST /api/users/assistants
// @desc    Créer un accès assistant (commandes + liens de paiement) avec mot de passe temporaire
// @access  Private/Admin
router.post('/assistants', isAdmin, [
  body('name').trim().notEmpty().withMessage('Le nom est requis'),
  body('email').isEmail().withMessage('Email invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation',
        errors: errors.array(),
      });
    }

    const name = req.body.name.trim();
    const email = req.body.email.trim().toLowerCase();
    
    // Générer un mot de passe temporaire
    const temporaryPassword = generateTemporaryPassword();
    const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.isAdmin || existing.role === 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Cet email appartient déjà à un administrateur',
        });
      }
      if (existing.role === 'assistant') {
        return res.status(400).json({
          success: false,
          message: 'Un accès assistant existe déjà pour cet email',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé par un compte client',
      });
    }

    const assistant = await User.create({
      name,
      email,
      temporaryPassword,
      temporaryPasswordExpires,
      forcePasswordChange: true,
      role: 'assistant',
      isAdmin: false,
    });

    res.status(201).json({
      success: true,
      message: 'Accès assistant créé avec mot de passe temporaire',
      data: { 
        assistant: sansMotDePasse(assistant),
        temporaryPassword, // Envoyer le mot de passe temporaire à l'admin
        temporaryPasswordExpires 
      },
    });
  } catch (error) {
    console.error('Erreur création assistant:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur',
    });
  }
});

// @route   DELETE /api/users/assistants/:id
// @desc    Révoquer un accès assistant
// @access  Private/Admin
router.delete('/assistants/:id', isAdmin, async (req, res) => {
  try {
    const assistant = await User.findById(req.params.id);
    if (!assistant || assistant.role !== 'assistant') {
      return res.status(404).json({
        success: false,
        message: 'Assistant non trouvé',
      });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: 'Accès assistant révoqué',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   GET /api/users/:id
// @desc    Obtenir un utilisateur par ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    // L'utilisateur ne peut voir que son propre profil (sauf admin)
    if (req.userId !== req.params.id && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé',
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

export default router;

