import express from 'express';
import Stripe from 'stripe';
import Commande from '../models/Commande.model.js';
// Middleware optionnel pour l'authentification
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
    next();
  }
};

const router = express.Router();

// Initialiser Stripe avec la clé secrète
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ ERREUR CRITIQUE: STRIPE_SECRET_KEY n\'est pas configurée !');
  throw new Error('STRIPE_SECRET_KEY est requise pour le fonctionnement de l\'application');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// @route   POST /api/paiement/create-intent
// @desc    Créer un PaymentIntent pour une commande
// @access  Public (avec optionalAuth)
router.post('/create-intent', optionalAuth, async (req, res) => {
  try {
    const { montant, commandeId } = req.body;

    if (!montant || montant <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le montant est requis et doit être supérieur à 0',
      });
    }

    // Convertir le montant en cents (Stripe utilise les cents)
    const amountInCents = Math.round(montant * 100);

    // Créer le PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'cad', // CAD pour dollars canadiens
      metadata: {
        commandeId: commandeId || 'pending',
      },
      automatic_payment_methods: {
        enabled: true,
      },
      // Spécifier le pays pour aider Stripe à détecter le format du code postal
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',
        },
      },
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Erreur Stripe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du paiement',
      error: error.message,
    });
  }
});

// @route   POST /api/paiement/confirm
// @desc    Confirmer le paiement et mettre à jour la commande
// @access  Public (avec optionalAuth)
router.post('/confirm', optionalAuth, async (req, res) => {
  try {
    const { paymentIntentId, commandeId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'PaymentIntent ID requis',
      });
    }

    // Récupérer le PaymentIntent depuis Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Le paiement n\'a pas été complété',
        status: paymentIntent.status,
      });
    }

    // Si une commandeId est fournie, mettre à jour la commande
    if (commandeId) {
      const commande = await Commande.findById(commandeId).populate('user', 'name email').populate('boites.saveurs.biscuit');
      if (commande) {
        commande.statut = 'en_traitement';
        commande.paiementConfirme = true;
        commande.stripePaymentIntentId = paymentIntentId;
        await commande.save();

        // Envoyer l'email de confirmation après paiement réussi
        try {
          const { envoyerEmailConfirmation } = await import('../services/email.service.js');
          
          // Déterminer l'email et le nom selon le type de commande
          const email = commande.user ? commande.user.email : commande.visiteurEmail;
          const nom = commande.user ? commande.user.name : commande.visiteurNom;
          
          await envoyerEmailConfirmation({
            to: email,
            nomClient: nom,
            numeroCommande: commande._id.toString().slice(-6),
            total: commande.total,
            typeReception: commande.typeReception,
            pointRamassage: commande.pointRamassage,
            dateRamassage: commande.dateRamassage,
            heureRamassage: commande.heureRamassage,
            villeLivraison: commande.villeLivraison,
            adresseLivraison: commande.adresseLivraison,
            dateLivraison: commande.dateLivraison,
            heureLivraison: commande.heureLivraison,
            boites: commande.boites,
          });
        } catch (emailError) {
          console.error('Erreur lors de l\'envoi de l\'email:', emailError);
          // Ne pas bloquer la confirmation du paiement si l'email échoue
        }
      }
    }

    res.json({
      success: true,
      message: 'Paiement confirmé avec succès',
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convertir en dollars
        status: paymentIntent.status,
      },
    });
  } catch (error) {
    console.error('Erreur confirmation paiement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la confirmation du paiement',
      error: error.message,
    });
  }
});

export default router;
