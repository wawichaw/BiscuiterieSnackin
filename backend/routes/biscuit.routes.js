import express from 'express';
import { body, validationResult } from 'express-validator';
import Biscuit from '../models/Biscuit.model.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// @route   GET /api/biscuits
// @desc    Obtenir tous les biscuits (public: seulement disponibles, admin: tous)
// @access  Public
router.get('/', async (req, res) => {
  try {
    // Vérifier si l'utilisateur est admin (optionnel, pour retourner tous les biscuits)
    let query = { disponible: true };
    
    // Si l'utilisateur est authentifié et admin, retourner tous les biscuits
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const { verifyToken } = await import('../config/jwt.js');
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        const User = (await import('../models/User.model.js')).default;
        const user = await User.findById(decoded.userId);
        if (user && user.isAdmin) {
          query = {}; // Retourner tous les biscuits pour l'admin
        }
      }
    } catch (e) {
      // Si erreur d'authentification, continuer avec la requête publique
    }

    const biscuits = await Biscuit.find(query)
      .select('nom description prix image saveur disponible stock createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      count: biscuits.length,
      data: { biscuits },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   GET /api/biscuits/:id
// @desc    Obtenir un biscuit par ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const biscuit = await Biscuit.findById(req.params.id);
    
    if (!biscuit) {
      return res.status(404).json({
        success: false,
        message: 'Biscuit non trouvé',
      });
    }

    res.json({
      success: true,
      data: { biscuit },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   POST /api/biscuits
// @desc    Créer un nouveau biscuit
// @access  Private/Admin
router.post('/', authenticate, isAdmin, [
  body('nom').trim().notEmpty().withMessage('Le nom est requis'),
  body('prix').isFloat({ min: 0 }).withMessage('Le prix doit être un nombre positif'),
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

    const biscuit = await Biscuit.create(req.body);
    res.status(201).json({
      success: true,
      message: 'Biscuit créé avec succès',
      data: { biscuit },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   PUT /api/biscuits/:id
// @desc    Mettre à jour un biscuit
// @access  Private/Admin
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const biscuit = await Biscuit.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!biscuit) {
      return res.status(404).json({
        success: false,
        message: 'Biscuit non trouvé',
      });
    }

    res.json({
      success: true,
      message: 'Biscuit mis à jour avec succès',
      data: { biscuit },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   DELETE /api/biscuits/:id
// @desc    Supprimer un biscuit
// @access  Private/Admin
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const biscuit = await Biscuit.findByIdAndDelete(req.params.id);

    if (!biscuit) {
      return res.status(404).json({
        success: false,
        message: 'Biscuit non trouvé',
      });
    }

    res.json({
      success: true,
      message: 'Biscuit supprimé avec succès',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

export default router;

