import express from 'express';
import { body, validationResult } from 'express-validator';
import HoraireRamassage from '../models/HoraireRamassage.model.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';
import { buildPointRamassage, genererHeures, HEURE_REGEX } from '../utils/horaireHelpers.js';

const router = express.Router();

const legacyVilleLabels = {
  laval: 'Laval',
  montreal: 'Montréal',
  repentigny: 'Repentigny',
};

const enrichHoraire = (h) => {
  const doc = h.toObject ? h.toObject() : h;
  return {
    ...doc,
    ville: doc.ville || legacyVilleLabels[doc.pointRamassage] || doc.pointRamassage,
    adresse: doc.adresse || '',
  };
};

// @route   GET /api/horaires/lieux
// @desc    Points de ramassage actifs (ville + adresse)
// @access  Public
router.get('/lieux', async (req, res) => {
  try {
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);

    const horaires = await HoraireRamassage.find({
      disponible: true,
      date: { $gte: aujourdhui },
    }).select('pointRamassage ville adresse');

    const lieuxMap = new Map();
    horaires.forEach((h) => {
      const enriched = enrichHoraire(h);
      if (!lieuxMap.has(enriched.pointRamassage)) {
        lieuxMap.set(enriched.pointRamassage, {
          pointRamassage: enriched.pointRamassage,
          ville: enriched.ville,
          adresse: enriched.adresse,
        });
      }
    });

    res.json({
      success: true,
      data: { lieux: [...lieuxMap.values()] },
    });
  } catch (error) {
    console.error('Erreur lieux horaires:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// @route   GET /api/horaires/dates
router.get('/dates', async (req, res) => {
  try {
    const { pointRamassage } = req.query;
    if (!pointRamassage) {
      return res.status(400).json({ success: false, message: 'pointRamassage est requis' });
    }

    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);

    const horaires = await HoraireRamassage.find({
      pointRamassage,
      disponible: true,
      date: { $gte: aujourdhui },
    })
      .sort({ date: 1 })
      .select('date');

    const dates = [...new Set(horaires.map((h) => h.date.toISOString().split('T')[0]))];

    res.json({ success: true, data: { dates } });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// @route   GET /api/horaires
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
      return res.json({ success: true, data: { heures: [] } });
    }

    res.json({ success: true, data: { heures: horaire.heures } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// @route   GET /api/horaires/all
router.get('/all', authenticate, isAdmin, async (req, res) => {
  try {
    const horaires = await HoraireRamassage.find().sort({ ville: 1, date: 1 });
    res.json({
      success: true,
      count: horaires.length,
      data: { horaires: horaires.map(enrichHoraire) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// @route   POST /api/horaires
router.post('/', authenticate, isAdmin, [
  body('ville').trim().notEmpty().withMessage('La ville est requise'),
  body('adresse').trim().notEmpty().withMessage('L\'adresse est requise'),
  body('date').notEmpty().withMessage('La date est requise'),
  body('heureDebut').matches(HEURE_REGEX).withMessage('Heure de début invalide (HH:MM)'),
  body('heureFin').matches(HEURE_REGEX).withMessage('Heure de fin invalide (HH:MM)'),
  body('intervalleMinutes').optional().isInt({ min: 15, max: 120 }).withMessage('Intervalle invalide'),
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

    const {
      ville,
      adresse,
      date,
      heureDebut,
      heureFin,
      intervalleMinutes = 30,
      disponible = true,
    } = req.body;

    let heures;
    try {
      heures = genererHeures(heureDebut, heureFin, Number(intervalleMinutes));
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const pointRamassage = buildPointRamassage(ville, adresse);

    const horaire = await HoraireRamassage.findOneAndUpdate(
      { pointRamassage, date: new Date(date) },
      {
        pointRamassage,
        ville: ville.trim(),
        adresse: adresse.trim(),
        date: new Date(date),
        heureDebut,
        heureFin,
        intervalleMinutes: Number(intervalleMinutes),
        heures,
        disponible,
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json({
      success: true,
      message: 'Horaire créé/mis à jour avec succès',
      data: { horaire: enrichHoraire(horaire) },
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
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const horaire = await HoraireRamassage.findByIdAndDelete(req.params.id);
    if (!horaire) {
      return res.status(404).json({ success: false, message: 'Horaire non trouvé' });
    }
    res.json({ success: true, message: 'Horaire supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
