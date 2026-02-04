import express from 'express';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';
import User from '../models/User.model.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

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

