import express from 'express';
import { body, validationResult } from 'express-validator';
import GaleriePhoto from '../models/GaleriePhoto.model.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Taille max pour une image base64 (4 Mo en caractères base64 ≈ 3 Mo décodé)
const MAX_BASE64_IMAGE_LENGTH = 4 * 1024 * 1024;

// @route   GET /api/galerie
// @desc    Obtenir toutes les photos de la galerie (actives seulement)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const photos = await GaleriePhoto.find({ actif: true })
      .sort({ ordre: 1, createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      count: photos.length,
      data: { photos },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   POST /api/galerie
// @desc    Ajouter une photo à la galerie
// @access  Private/Admin
router.post('/', authenticate, isAdmin, [
  body('image')
    .notEmpty().withMessage('L\'image est requise')
    .custom((value) => {
      const base64Part = typeof value === 'string' && value.includes(',') ? value.split(',')[1] : value;
      const length = typeof base64Part === 'string' ? base64Part.length : 0;
      if (length > MAX_BASE64_IMAGE_LENGTH) {
        throw new Error('L\'image ne doit pas dépasser 4 Mo');
      }
      return true;
    }),
  body('titre').optional().trim(),
  body('description').optional().trim(),
  body('ordre').optional().isInt(),
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

    const photo = await GaleriePhoto.create({
      image: req.body.image,
      titre: req.body.titre || '',
      description: req.body.description || '',
      ordre: req.body.ordre || 0,
      actif: true,
    });

    res.status(201).json({
      success: true,
      message: 'Photo ajoutée à la galerie avec succès',
      data: { photo },
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   DELETE /api/galerie/:id
// @desc    Supprimer une photo de la galerie
// @access  Private/Admin
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const photo = await GaleriePhoto.findByIdAndDelete(req.params.id);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo non trouvée',
      });
    }

    res.json({
      success: true,
      message: 'Photo supprimée avec succès',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

export default router;
