import express from 'express';
import { body, validationResult } from 'express-validator';
import HoraireRamassage from '../models/HoraireRamassage.model.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// @route   GET /api/horaires/dates
// @desc    Obtenir toutes les dates disponibles pour un lieu
// @access  Public
router.get('/dates', async (req, res) => {
  try {
    const { pointRamassage } = req.query;

    if (!pointRamassage) {
      return res.status(400).json({
        success: false,
        message: 'pointRamassage est requis',
      });
    }

    // Récupérer toutes les dates disponibles pour ce lieu (futures uniquement)
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);

    const horaires = await HoraireRamassage.find({
      pointRamassage,
      disponible: true,
      date: { $gte: aujourdhui },
    })
      .sort({ date: 1 })
      .select('date');

    // Extraire les dates uniques et les formater
    const dates = [...new Set(horaires.map(h => h.date.toISOString().split('T')[0]))];

    res.json({
      success: true,
      data: { dates },
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   GET /api/horaires
// @desc    Obtenir les horaires disponibles pour un lieu et une date
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { pointRamassage, date } = req.query;

    if (!pointRamassage || !date) {
      return res.status(400).json({
        success: false,
        message: 'pointRamassage et date sont requis',
      });
    }

    const horaire = await HoraireRamassage.findOne({
      pointRamassage,
      date: new Date(date),
      disponible: true,
    });

    if (!horaire) {
      return res.json({
        success: true,
        data: { heures: [] },
      });
    }

    res.json({
      success: true,
      data: { heures: horaire.heures },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   GET /api/horaires/all
// @desc    Obtenir tous les horaires (admin)
// @access  Private/Admin
router.get('/all', authenticate, isAdmin, async (req, res) => {
  try {
    const horaires = await HoraireRamassage.find()
      .sort({ pointRamassage: 1, date: 1 });

    res.json({
      success: true,
      count: horaires.length,
      data: { horaires },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   POST /api/horaires
// @desc    Créer ou mettre à jour un horaire
// @access  Private/Admin
router.post('/', authenticate, isAdmin, [
  body('pointRamassage').isIn(['laval', 'montreal', 'repentigny']).withMessage('Point de ramassage invalide'),
  body('date').notEmpty().withMessage('La date est requise'),
  body('heures').isArray({ min: 1 }).withMessage('Au moins une heure est requise'),
  body('heures.*').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Format d\'heure invalide (HH:MM)'),
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

    const { pointRamassage, date, heures, disponible = true } = req.body;

    const horaire = await HoraireRamassage.findOneAndUpdate(
      { pointRamassage, date: new Date(date) },
      {
        pointRamassage,
        date: new Date(date),
        heures,
        disponible,
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json({
      success: true,
      message: 'Horaire créé/mis à jour avec succès',
      data: { horaire },
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur',
    });
  }
});

// @route   DELETE /api/horaires/:id
// @desc    Supprimer un horaire
// @access  Private/Admin
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const horaire = await HoraireRamassage.findByIdAndDelete(req.params.id);

    if (!horaire) {
      return res.status(404).json({
        success: false,
        message: 'Horaire non trouvé',
      });
    }

    res.json({
      success: true,
      message: 'Horaire supprimé avec succès',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

export default router;

