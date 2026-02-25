import express from 'express';
import { body, validationResult } from 'express-validator';
import TarifsBoites from '../models/TarifsBoites.model.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

const TAILLES = [4, 6, 12];

/**
 * GET /api/tarifs/boites
 * Retourne les prix des boîtes (public, pour la page Commander).
 */
router.get('/boites', async (req, res) => {
  try {
    let doc = await TarifsBoites.findOne().lean();
    if (!doc) {
      doc = await TarifsBoites.create({});
      doc = doc.toObject();
    }
    const prixBoites = {
      4: doc.prix4,
      6: doc.prix6,
      12: doc.prix12,
    };
    res.json({
      success: true,
      data: { prixBoites },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

/**
 * PUT /api/tarifs/boites
 * Met à jour les prix des boîtes (admin).
 */
router.put('/boites', authenticate, isAdmin, [
  body('prix4').optional().isFloat({ min: 0 }).withMessage('Prix boîte 4 invalide'),
  body('prix6').optional().isFloat({ min: 0 }).withMessage('Prix boîte 6 invalide'),
  body('prix12').optional().isFloat({ min: 0 }).withMessage('Prix boîte 12 invalide'),
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
    TAILLES.forEach(t => {
      const key = `prix${t}`;
      if (req.body[key] !== undefined) update[key] = Number(req.body[key]);
    });
    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun prix à mettre à jour',
      });
    }

    const doc = await TarifsBoites.findOneAndUpdate(
      {},
      { $set: update },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: 'Prix des boîtes mis à jour',
      data: {
        prixBoites: {
          4: doc.prix4,
          6: doc.prix6,
          12: doc.prix12,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

export default router;
