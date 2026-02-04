import express from 'express';
import { body, validationResult } from 'express-validator';
import Commentaire from '../models/Commentaire.model.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';
import { verifyRecaptcha } from '../middleware/recaptcha.middleware.js';

const router = express.Router();

// Taille max par image base64 (2 Mo) et nombre max de photos
const MAX_PHOTO_BASE64_LENGTH = 2 * 1024 * 1024;
const MAX_PHOTOS = 5;

// @route   GET /api/commentaires
// @desc    Obtenir tous les commentaires (publics seulement, ou tous si admin)
// @access  Public
router.get('/', async (req, res) => {
  try {
    // Vérifier si l'utilisateur est admin
    let query = { approuve: true };
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const { verifyToken } = await import('../config/jwt.js');
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        const User = (await import('../models/User.model.js')).default;
        const user = await User.findById(decoded.userId);
        if (user && user.isAdmin) {
          query = {}; // Admin voit tous les commentaires
        }
      }
    } catch (e) {
      // Pas authentifié ou erreur, continuer avec la requête publique
    }

    const commentaires = await Commentaire.find(query)
      .populate('user', 'name email')
      .populate('biscuit', 'nom')
      .populate('reponseAdmin.admin', 'name')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: commentaires.length,
      data: { commentaires },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   POST /api/commentaires
// @desc    Créer un nouveau commentaire (public ou authentifié)
// @access  Public (mais peut être authentifié)
router.post('/', [
  verifyRecaptcha(0.5), // Score minimum 0.5
  body('texte').trim().notEmpty().withMessage('Le texte est requis'),
  body('note').optional().isInt({ min: 1, max: 5 }).withMessage('La note doit être entre 1 et 5'),
  body('nom').optional().trim().notEmpty().withMessage('Le nom est requis si pas authentifié'),
  body('photos')
    .optional()
    .isArray({ max: MAX_PHOTOS })
    .withMessage(`Maximum ${MAX_PHOTOS} photos autorisées`)
    .custom((photos) => {
      if (!Array.isArray(photos)) return true;
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (typeof p !== 'string') continue;
        const base64Part = p.includes(',') ? p.split(',')[1] : p;
        const length = (base64Part || '').length;
        if (length > MAX_PHOTO_BASE64_LENGTH) {
          throw new Error(`La photo ${i + 1} ne doit pas dépasser 2 Mo`);
        }
      }
      return true;
    }),
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

    // Vérifier si l'utilisateur est authentifié
    let userId = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const { verifyToken } = await import('../config/jwt.js');
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        userId = decoded.userId;
      }
    } catch (e) {
      // Pas authentifié, continuer avec commentaire anonyme
    }

    // Si pas authentifié, nom est requis
    if (!userId && !req.body.nom) {
      return res.status(400).json({
        success: false,
        message: 'Le nom est requis pour les commentaires anonymes',
      });
    }

    const commentaire = await Commentaire.create({
      user: userId || undefined,
      nom: req.body.nom || undefined,
      texte: req.body.texte,
      note: req.body.note ? Number(req.body.note) : undefined,
      photos: req.body.photos || [],
      approuve: false, // Nécessite approbation admin
    });

    if (userId) {
      await commentaire.populate('user', 'name email');
    }
    if (req.body.biscuit) {
      await commentaire.populate('biscuit', 'nom');
    }

    res.status(201).json({
      success: true,
      message: 'Commentaire créé avec succès (en attente d\'approbation)',
      data: { commentaire },
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   PUT /api/commentaires/:id/approve
// @desc    Approuver un commentaire
// @access  Private/Admin
router.put('/:id/approve', authenticate, isAdmin, async (req, res) => {
  try {
    const commentaire = await Commentaire.findByIdAndUpdate(
      req.params.id,
      { approuve: true },
      { new: true }
    ).populate('user', 'name').populate('biscuit', 'nom');

    if (!commentaire) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé',
      });
    }

    res.json({
      success: true,
      message: 'Commentaire approuvé',
      data: { commentaire },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   PUT /api/commentaires/:id/reponse
// @desc    Ajouter une réponse admin à un commentaire
// @access  Private/Admin
router.put('/:id/reponse', authenticate, isAdmin, [
  body('texte').trim().notEmpty().withMessage('Le texte de la réponse est requis'),
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

    const commentaire = await Commentaire.findByIdAndUpdate(
      req.params.id,
      {
        reponseAdmin: {
          texte: req.body.texte,
          admin: req.userId,
          date: new Date(),
        },
      },
      { new: true }
    ).populate('user', 'name').populate('biscuit', 'nom').populate('reponseAdmin.admin', 'name');

    if (!commentaire) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé',
      });
    }

    res.json({
      success: true,
      message: 'Réponse ajoutée avec succès',
      data: { commentaire },
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   DELETE /api/commentaires/:id
// @desc    Supprimer un commentaire (admin seulement pour modération)
// @access  Private/Admin
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const commentaire = await Commentaire.findById(req.params.id);

    if (!commentaire) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé',
      });
    }

    await commentaire.deleteOne();

    res.json({
      success: true,
      message: 'Commentaire supprimé avec succès',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

export default router;

