import express from 'express';
import Commande from '../models/Commande.model.js';
import stripe from '../config/stripe.js';
import { finaliserCommandeApresPaiement } from '../services/commande-paiement.service.js';
import { getInfosRamassagePourEmail } from '../services/ramassage.service.js';
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

    if (!commandeId) {
      return res.status(400).json({
        success: false,
        message: 'La commande doit être préparée avant le paiement',
      });
    }

    const commande = await Commande.findById(commandeId);
    if (!commande) {
      return res.status(404).json({
        success: false,
        message: 'Commande introuvable',
      });
    }

    if (commande.paiementConfirme) {
      return res.status(400).json({
        success: false,
        message: 'Cette commande est déjà payée',
      });
    }

    const amountInCents = Math.round(montant * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'cad',
      metadata: {
        commandeId: commandeId.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'always',
      },
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',
        },
      },
    });

    commande.stripePaymentIntentId = paymentIntent.id;
    await commande.save();

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
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

// @route   POST /api/paiement/finaliser
// @desc    Finaliser une commande après paiement réussi (carte, Link, Klarna, etc.)
// @access  Public (avec optionalAuth)
router.post('/finaliser', optionalAuth, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'PaymentIntent ID requis',
      });
    }

    const result = await finaliserCommandeApresPaiement(paymentIntentId);

    if (!result.success) {
      return res.status(result.commande ? 400 : 404).json({
        success: false,
        message: result.message,
        status: result.status,
        paymentIntentId: result.paymentIntentId,
      });
    }

    res.json({
      success: true,
      message: result.alreadyConfirmed ? 'Commande déjà confirmée' : 'Commande confirmée avec succès',
      data: { commande: result.commande },
    });
  } catch (error) {
    console.error('Erreur finalisation paiement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la finalisation du paiement',
      error: error.message,
    });
  }
});

// @route   POST /api/paiement/webhook
// @desc    Webhook Stripe — filet de sécurité pour Klarna, Link, redirections
// @access  Stripe uniquement
export const handleStripeWebhook = async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  let event;

  try {
    if (webhookSecret) {
      const signature = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString());
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET non configuré — webhook non vérifié');
    }
  } catch (error) {
    console.error('❌ Webhook Stripe invalide:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    try {
      await finaliserCommandeApresPaiement(paymentIntent.id);
    } catch (error) {
      console.error('❌ Erreur webhook payment_intent.succeeded:', error);
      return res.status(500).json({ received: false });
    }
  }

  res.json({ received: true });
};

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
          
          const ramassageExtras = commande.typeReception === 'ramassage'
            ? await getInfosRamassagePourEmail(commande.pointRamassage).then((infos) => ({
                villeRamassage: infos.ville,
                adresseRamassage: infos.adresse || undefined,
              }))
            : {};

          await envoyerEmailConfirmation({
            to: email,
            nomClient: nom,
            numeroCommande: commande._id.toString().slice(-6),
            total: commande.total,
            typeReception: commande.typeReception,
            pointRamassage: commande.pointRamassage,
            ...ramassageExtras,
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
