import express from 'express';
import { body, validationResult } from 'express-validator';
import Commande from '../models/Commande.model.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';
import { getInfosRamassagePourEmail } from '../services/ramassage.service.js';

const router = express.Router();

const extrasEmailRamassage = async (commande) => {
  if (commande.typeReception !== 'ramassage') return {};
  const infos = await getInfosRamassagePourEmail(commande.pointRamassage);
  return {
    villeRamassage: infos.ville,
    adresseRamassage: infos.adresse || undefined,
  };
};

// Middleware optionnel pour l'authentification (ne bloque pas si pas de token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { verifyToken } = await import('../config/jwt.js');
      const decoded = verifyToken(token);
      req.userId = decoded.userId;
    }
    next();
  } catch (error) {
    // Pas de token ou token invalide, continuer sans authentification
    next();
  }
};

// @route   GET /api/commandes
// @desc    Obtenir toutes les commandes (admin) ou les commandes de l'utilisateur
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est admin
    const User = (await import('../models/User.model.js')).default;
    const user = await User.findById(req.userId);
    const isAdmin = user && user.isAdmin;

    let commandes;
    
    if (isAdmin) {
      // Admin voit toutes les commandes
      commandes = await Commande.find().populate('user', 'name email').populate('boites.saveurs.biscuit');
    } else {
      // Utilisateur voit ses commandes + les commandes invité passées avec le même email (avant création de compte)
      const userEmail = (user && user.email) ? user.email.trim().toLowerCase() : '';
      commandes = await Commande.find({
        $or: [
          { user: req.userId },
          { user: null, visiteurEmail: { $regex: new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        ],
      }).populate('boites.saveurs.biscuit');
    }

    res.json({
      success: true,
      count: commandes.length,
      data: { commandes },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   GET /api/commandes/:id
// @desc    Obtenir une commande par ID
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const commande = await Commande.findById(req.params.id)
      .populate('user', 'name email')
      .populate('boites.saveurs.biscuit');

    if (!commande) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    // Vérifier que l'utilisateur peut voir cette commande
    const User = (await import('../models/User.model.js')).default;
    const user = await User.findById(req.userId);
    const isAdmin = user && user.isAdmin;
    
    if (commande.user._id.toString() !== req.userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé',
      });
    }

    res.json({
      success: true,
      data: { commande },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

// @route   POST /api/commandes
// @desc    Créer une nouvelle commande (avec ou sans authentification)
// @access  Public (authentification optionnelle)
router.post('/', optionalAuth, [
  body('boites').isArray({ min: 1 }).withMessage('Au moins une boîte est requise'),
  body('boites.*.taille').isIn([4, 6, 12]).withMessage('La taille doit être 4, 6 ou 12'),
  body('boites.*.saveurs').isArray().withMessage('Les saveurs doivent être un tableau'),
  body('typeReception').isIn(['ramassage', 'livraison']).withMessage('Type de réception invalide'),
  body('pointRamassage').if((value, { req }) => req.body.typeReception === 'ramassage').trim().notEmpty().withMessage('Point de ramassage requis'),
  body('dateRamassage').if((value, { req }) => req.body.typeReception === 'ramassage').notEmpty().withMessage('La date de ramassage est requise'),
  body('heureRamassage').if((value, { req }) => req.body.typeReception === 'ramassage').notEmpty().withMessage('L\'heure de ramassage est requise'),
  body('villeLivraison').if((value, { req }) => req.body.typeReception === 'livraison').isIn(['montreal', 'laval', 'repentigny', 'assomption', 'terrebonne']).withMessage('Ville de livraison invalide'),
  body('adresseLivraison.rue').if((value, { req }) => req.body.typeReception === 'livraison').notEmpty().withMessage('L\'adresse de livraison est requise'),
  body('adresseLivraison.codePostal').if((value, { req }) => req.body.typeReception === 'livraison').notEmpty().withMessage('Le code postal est requis'),
  body('dateLivraison').if((value, { req }) => req.body.typeReception === 'livraison').notEmpty().withMessage('La date de livraison est requise'),
  body('heureLivraison').if((value, { req }) => req.body.typeReception === 'livraison').notEmpty().withMessage('L\'heure de livraison est requise'),
  body('methodePaiement').isIn(['sur_place', 'en_ligne']).withMessage('Méthode de paiement invalide'),
  // Validation conditionnelle pour les visiteurs
  body('visiteurNom').if((value, { req }) => !req.userId).notEmpty().withMessage('Le nom est requis pour les commandes en mode visiteur'),
  body('visiteurEmail').if((value, { req }) => !req.userId).isEmail().withMessage('Un email valide est requis pour les commandes en mode visiteur'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Erreurs de validation:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation',
        errors: errors.array(),
      });
    }

    // Vérifier que chaque boîte a le bon nombre de saveurs
    for (const boite of req.body.boites) {
      const totalSaveurs = boite.saveurs.reduce((sum, s) => sum + s.quantite, 0);
      if (totalSaveurs !== boite.taille) {
        return res.status(400).json({
          success: false,
          message: `La boîte de ${boite.taille} doit contenir exactement ${boite.taille} biscuits`,
        });
      }

      // Vérifier que les biscuits existent
      const Biscuit = (await import('../models/Biscuit.model.js')).default;
      for (const saveur of boite.saveurs) {
        const biscuit = await Biscuit.findById(saveur.biscuit);
        if (!biscuit) {
          return res.status(400).json({
            success: false,
            message: `Biscuit avec l'ID ${saveur.biscuit} non trouvé`,
          });
        }
      }
    }

    // Calculer le total des boîtes
    const totalBoites = req.body.boites.reduce((sum, boite) => sum + boite.prix, 0);

    // Calculer les frais de livraison si nécessaire
    let fraisLivraison = 0;
    if (req.body.typeReception === 'livraison') {
      const dateLivraison = new Date(req.body.dateLivraison);
      const jourSemaine = dateLivraison.getDay(); // 0 = dimanche, 4 = jeudi
      const heureLivraison = req.body.heureLivraison;
      
      // Vérifier si c'est un jeudi (4) après 18h
      if (jourSemaine === 4) {
        const [heures, minutes] = heureLivraison.split(':').map(Number);
        if (heures >= 18) {
          fraisLivraison = 5;
        }
      }
    }

    const total = totalBoites + fraisLivraison;

    // Préparer les données de la commande
    const commandeData = {
      boites: req.body.boites,
      total,
      statut: 'en_attente',
      typeReception: req.body.typeReception,
      methodePaiement: req.body.methodePaiement,
      fraisLivraison,
      // Ajouter les champs de paiement si fournis
      paiementConfirme: req.body.paiementConfirme || false,
      stripePaymentIntentId: req.body.stripePaymentIntentId || null,
    };

    // Ajouter les données selon le type de réception
    if (req.body.typeReception === 'ramassage') {
      commandeData.pointRamassage = req.body.pointRamassage;
      commandeData.dateRamassage = new Date(req.body.dateRamassage);
      commandeData.heureRamassage = req.body.heureRamassage;
    } else {
      commandeData.villeLivraison = req.body.villeLivraison;
      commandeData.adresseLivraison = {
        rue: req.body.adresseLivraison.rue,
        codePostal: req.body.adresseLivraison.codePostal,
        instructions: req.body.adresseLivraison.instructions || '',
      };
      commandeData.dateLivraison = new Date(req.body.dateLivraison);
      commandeData.heureLivraison = req.body.heureLivraison;
    }

    // Si l'utilisateur est connecté, utiliser son ID
    if (req.userId) {
      commandeData.user = req.userId;
    } else {
      // Sinon, utiliser les informations du visiteur
      commandeData.visiteurNom = req.body.visiteurNom;
      commandeData.visiteurEmail = req.body.visiteurEmail;
      if (req.body.visiteurTelephone) {
        commandeData.visiteurTelephone = req.body.visiteurTelephone;
      }
    }

    const commande = await Commande.create(commandeData);

    await commande.populate('boites.saveurs.biscuit');
    if (commande.user) {
      await commande.populate('user', 'name email');
    }

    // Envoyer l'email de confirmation pour toute commande (en ligne ou sur place)
    {
      const email = commande.user ? commande.user.email : commande.visiteurEmail;
      const nom = commande.user ? commande.user.name : commande.visiteurNom;
      try {
        const { envoyerEmailConfirmation } = await import('../services/email.service.js');
        const result = await envoyerEmailConfirmation({
          to: email,
          nomClient: nom,
          numeroCommande: commande._id.toString().slice(-6),
          total: commande.total,
          typeReception: commande.typeReception,
          pointRamassage: commande.pointRamassage,
          ...(await extrasEmailRamassage(commande)),
          dateRamassage: commande.dateRamassage,
          heureRamassage: commande.heureRamassage,
          villeLivraison: commande.villeLivraison,
          adresseLivraison: commande.adresseLivraison,
          dateLivraison: commande.dateLivraison,
          heureLivraison: commande.heureLivraison,
          boites: commande.boites,
        });
        if (!result.success) {
          console.error('❌ Email confirmation non envoyé à', email, ':', result.message || result.error);
        }
      } catch (emailError) {
        console.error('❌ Erreur envoi email confirmation à', email, ':', emailError.message || emailError);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Commande créée avec succès',
      data: { commande },
    });
  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
});

// @route   PUT /api/commandes/:id
// @desc    Mettre à jour une commande (admin seulement pour changer le statut)
// @access  Private/Admin
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const ancienneCommande = await Commande.findById(req.params.id).populate('user', 'name email');
    
    if (!ancienneCommande) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    // Mettre à jour la commande
    const commande = await Commande.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('user', 'name email').populate('boites.saveurs.biscuit');

    console.log('📦 Commande mise à jour:', commande._id);
    console.log('📦 Nouveau statut:', req.body.statut);
    console.log('📦 Ancien statut:', ancienneCommande.statut);

    // Si le statut passe à "en_traitement", envoyer un email
    if (req.body.statut === 'en_traitement' && ancienneCommande.statut !== 'en_traitement') {
      try {
        const { envoyerEmailConfirmation } = await import('../services/email.service.js');
        
        // S'assurer que la commande a toutes les données nécessaires
        await commande.populate('boites.saveurs.biscuit');
        
        // Déterminer l'email et le nom selon le type de commande
        const email = commande.user ? (commande.user.email || commande.visiteurEmail) : commande.visiteurEmail;
        const nom = commande.user ? (commande.user.name || commande.visiteurNom) : commande.visiteurNom;
        
        if (!email) {
          console.warn('⚠️  Aucun email trouvé pour la commande:', commande._id);
          console.warn('⚠️  Commande user:', commande.user);
          console.warn('⚠️  Commande visiteurEmail:', commande.visiteurEmail);
        } else {
          console.log('📧 Envoi email "en_traitement" à:', email);
          const emailResult = await envoyerEmailConfirmation({
            to: email,
            nomClient: nom,
            numeroCommande: commande._id.toString().slice(-6),
            total: commande.total,
            typeReception: commande.typeReception,
            pointRamassage: commande.pointRamassage,
            ...(await extrasEmailRamassage(commande)),
            dateRamassage: commande.dateRamassage,
            heureRamassage: commande.heureRamassage,
            villeLivraison: commande.villeLivraison,
            adresseLivraison: commande.adresseLivraison,
            dateLivraison: commande.dateLivraison,
            heureLivraison: commande.heureLivraison,
            boites: commande.boites,
          });
          
          if (emailResult.success) {
            console.log('✅ Email de confirmation envoyé à:', email);
          } else {
            console.error('❌ Erreur lors de l\'envoi de l\'email:', emailResult.message || emailResult.error);
          }
        }
      } catch (emailError) {
        console.error('❌ Erreur lors de l\'envoi de l\'email:', emailError);
        console.error('❌ Stack:', emailError.stack);
        // Ne pas bloquer la mise à jour de la commande si l'email échoue
      }
    }

    // Si le statut passe à "completee", envoyer un email de remerciement avec invitation à laisser un avis
    if (req.body.statut === 'completee' && ancienneCommande.statut !== 'completee') {
      try {
        const { envoyerEmailRemerciement } = await import('../services/email.service.js');
        
        // Déterminer l'email et le nom selon le type de commande
        const email = commande.user ? (commande.user.email || commande.visiteurEmail) : commande.visiteurEmail;
        const nom = commande.user ? (commande.user.name || commande.visiteurNom) : commande.visiteurNom;
        
        if (!email) {
          console.warn('⚠️  Aucun email trouvé pour la commande complétée:', commande._id);
        } else {
          console.log('📧 Envoi email "complétée" à:', email);
          const emailResult = await envoyerEmailRemerciement({
            to: email,
            nomClient: nom,
            numeroCommande: commande._id.toString().slice(-6),
          });
          
          if (emailResult.success) {
            console.log('✅ Email de remerciement envoyé à:', email);
          } else {
            console.error('❌ Erreur lors de l\'envoi de l\'email de remerciement:', emailResult.message || emailResult.error);
          }
        }
      } catch (emailError) {
        console.error('❌ Erreur lors de l\'envoi de l\'email de remerciement:', emailError);
        // Ne pas bloquer la mise à jour de la commande si l'email échoue
      }
    }

    res.json({
      success: true,
      message: 'Commande mise à jour avec succès',
      data: { commande },
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la commande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
});

export default router;

