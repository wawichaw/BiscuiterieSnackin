import express from 'express';
import { body, validationResult } from 'express-validator';
import HoraireRamassage from '../models/HoraireRamassage.model.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';
import { buildPointRamassage, genererHeures, HEURE_REGEX, collectDatesFromHoraire, horaireCorrespondADate, formatJoursSemaine, sanitizeLieuPourClient, validerHeures, filtrerDatesDisponibles, filtrerHeuresDisponibles, getNowMontreal, getDateMinimumCommande } from '../utils/horaireHelpers.js';
import { getParametresCommande, updateParametresCommande } from '../services/parametres-commande.service.js';

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
    joursSemaine: doc.joursSemaine || [],
    joursSemaineLabel: doc.joursSemaine?.length ? formatJoursSemaine(doc.joursSemaine) : null,
    prochainesDates: collectDatesFromHoraire(doc, 4),
  };
};

const horaireEstActif = (h) => {
  if (!h.disponible) return false;
  if (h.joursSemaine?.length) return true;
  if (!h.date) return false;
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return new Date(h.date) >= aujourdhui;
};

// @route   GET /api/horaires/regles-commande
// @desc    Règles de délai pour les commandes (public)
// @access  Public
router.get('/regles-commande', async (req, res) => {
  try {
    const parametres = await getParametresCommande();
    const now = getNowMontreal();
    res.json({
      success: true,
      data: {
        parametres,
        dateMinimum: getDateMinimumCommande(parametres, now),
        maintenant: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Erreur regles-commande:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// @route   PUT /api/horaires/regles-commande
// @desc    Modifier les règles de délai (admin)
// @access  Private/Admin
router.put('/regles-commande', authenticate, isAdmin, [
  body('actif').optional().isBoolean().withMessage('actif doit être un booléen'),
  body('heureLimiteCommande').optional().matches(HEURE_REGEX).withMessage('Heure limite invalide (HH:MM)'),
  body('delaiMinimumMinutes').optional().isInt({ min: 0, max: 1440 }).withMessage('Délai minimum invalide'),
  body('bloquerJourMeme').optional().isBoolean().withMessage('bloquerJourMeme doit être un booléen'),
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

    const update = {};
    if (req.body.actif !== undefined) update.actif = Boolean(req.body.actif);
    if (req.body.heureLimiteCommande !== undefined) update.heureLimiteCommande = req.body.heureLimiteCommande;
    if (req.body.delaiMinimumMinutes !== undefined) update.delaiMinimumMinutes = Number(req.body.delaiMinimumMinutes);
    if (req.body.bloquerJourMeme !== undefined) update.bloquerJourMeme = Boolean(req.body.bloquerJourMeme);

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun paramètre à mettre à jour' });
    }

    const parametres = await updateParametresCommande(update);
    res.json({
      success: true,
      message: 'Règles de commande mises à jour',
      data: { parametres },
    });
  } catch (error) {
    console.error('Erreur regles-commande:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// @route   GET /api/horaires/lieux
// @desc    Points de ramassage actifs (ville + adresse)
// @access  Public
router.get('/lieux', async (req, res) => {
  try {
    const horaires = await HoraireRamassage.find({ disponible: true });

    const lieuxMap = new Map();
    horaires.filter(horaireEstActif).forEach((h) => {
      const enriched = enrichHoraire(h);
      if (!lieuxMap.has(enriched.pointRamassage)) {
        lieuxMap.set(enriched.pointRamassage, sanitizeLieuPourClient({
          pointRamassage: enriched.pointRamassage,
          ville: enriched.ville,
          adresse: enriched.adresse,
        }));
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

    const horaires = await HoraireRamassage.find({
      pointRamassage,
      disponible: true,
    });

    const datesSet = new Set();
    horaires.forEach((h) => {
      collectDatesFromHoraire(h, 4).forEach((d) => datesSet.add(d));
    });

    const parametres = await getParametresCommande();
    const now = getNowMontreal();
    const dates = filtrerDatesDisponibles([...datesSet].sort(), parametres, now);

    res.json({ success: true, data: { dates, parametres } });
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

    const horaires = await HoraireRamassage.find({
      pointRamassage,
      disponible: true,
    });

    const horaire = horaires.find((h) => horaireCorrespondADate(h, date));

    if (!horaire) {
      return res.json({ success: true, data: { heures: [] } });
    }

    const parametres = await getParametresCommande();
    const now = getNowMontreal();
    const heures = filtrerHeuresDisponibles(horaire.heures, date, parametres, now);

    res.json({ success: true, data: { heures } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// @route   GET /api/horaires/all
router.get('/all', authenticate, isAdmin, async (req, res) => {
  try {
    const horaires = await HoraireRamassage.find().sort({ ville: 1, createdAt: -1 });
    res.json({
      success: true,
      count: horaires.length,
      data: { horaires: horaires.map(enrichHoraire) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

const resolveHeures = (body) => {
  if (Array.isArray(body.heures) && body.heures.length > 0) {
    return validerHeures(body.heures);
  }
  return validerHeures(genererHeures(body.heureDebut, body.heureFin, Number(body.intervalleMinutes || 30)));
};

const reglesHoraire = [
  body('ville').trim().notEmpty().withMessage('La ville est requise'),
  body('adresse').trim().notEmpty().withMessage('L\'adresse est requise'),
  body('joursSemaine').isArray({ min: 1 }).withMessage('Sélectionnez au moins un jour'),
  body('joursSemaine.*').isInt({ min: 0, max: 6 }).withMessage('Jour invalide'),
  body('heureDebut').matches(HEURE_REGEX).withMessage('Heure de début invalide (HH:MM)'),
  body('heureFin').matches(HEURE_REGEX).withMessage('Heure de fin invalide (HH:MM)'),
  body('intervalleMinutes').optional().isInt({ min: 15, max: 120 }).withMessage('Intervalle invalide'),
  body('heures').optional().isArray({ min: 1 }).withMessage('Au moins un créneau horaire est requis'),
  body('heures.*').optional().matches(HEURE_REGEX).withMessage('Créneau horaire invalide (HH:MM)'),
  body('disponible').optional().isBoolean().withMessage('disponible doit être un booléen'),
];

// @route   POST /api/horaires
router.post('/', authenticate, isAdmin, reglesHoraire, async (req, res) => {
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
      joursSemaine,
      heureDebut,
      heureFin,
      intervalleMinutes = 30,
      disponible = true,
    } = req.body;

    const joursUniques = [...new Set(joursSemaine.map(Number))].sort((a, b) => a - b);

    let heures;
    try {
      heures = resolveHeures(req.body);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const pointRamassage = buildPointRamassage(ville, adresse);

    const horaire = await HoraireRamassage.findOneAndUpdate(
      { pointRamassage },
      {
        pointRamassage,
        ville: ville.trim(),
        adresse: adresse.trim(),
        joursSemaine: joursUniques,
        heureDebut,
        heureFin,
        intervalleMinutes: Number(intervalleMinutes),
        heures,
        disponible,
        $unset: { date: '' },
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

// @route   PUT /api/horaires/:id
// @desc    Modifier une plage horaire existante
// @access  Private/Admin
router.put('/:id', authenticate, isAdmin, reglesHoraire, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation',
        errors: errors.array(),
      });
    }

    const horaire = await HoraireRamassage.findById(req.params.id);
    if (!horaire) {
      return res.status(404).json({ success: false, message: 'Horaire non trouvé' });
    }

    const {
      ville,
      adresse,
      joursSemaine,
      heureDebut,
      heureFin,
      intervalleMinutes = 30,
      disponible = true,
    } = req.body;

    const joursUniques = [...new Set(joursSemaine.map(Number))].sort((a, b) => a - b);

    let heures;
    try {
      heures = resolveHeures(req.body);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const pointRamassage = buildPointRamassage(ville, adresse);

    if (pointRamassage !== horaire.pointRamassage) {
      const conflit = await HoraireRamassage.findOne({
        pointRamassage,
        _id: { $ne: horaire._id },
      });
      if (conflit) {
        return res.status(400).json({
          success: false,
          message: 'Un autre point de ramassage existe déjà avec cette ville et adresse',
        });
      }
    }

    horaire.pointRamassage = pointRamassage;
    horaire.ville = ville.trim();
    horaire.adresse = adresse.trim();
    horaire.joursSemaine = joursUniques;
    horaire.heureDebut = heureDebut;
    horaire.heureFin = heureFin;
    horaire.intervalleMinutes = Number(intervalleMinutes);
    horaire.heures = heures;
    horaire.disponible = disponible;

    await HoraireRamassage.updateOne(
      { _id: horaire._id },
      {
        $set: {
          pointRamassage: horaire.pointRamassage,
          ville: horaire.ville,
          adresse: horaire.adresse,
          joursSemaine: horaire.joursSemaine,
          heureDebut: horaire.heureDebut,
          heureFin: horaire.heureFin,
          intervalleMinutes: horaire.intervalleMinutes,
          heures: horaire.heures,
          disponible: horaire.disponible,
        },
        $unset: { date: '' },
      },
    );

    const updated = await HoraireRamassage.findById(horaire._id);

    res.json({
      success: true,
      message: 'Horaire mis à jour avec succès',
      data: { horaire: enrichHoraire(updated) },
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
