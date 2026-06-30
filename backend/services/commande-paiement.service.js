import Commande from '../models/Commande.model.js';
import stripe from '../config/stripe.js';
import { getInfosRamassagePourEmail } from './ramassage.service.js';

const extrasEmailRamassage = async (commande) => {
  if (commande.typeReception !== 'ramassage') return {};
  const infos = await getInfosRamassagePourEmail(commande.pointRamassage);
  return {
    villeRamassage: infos.ville,
    adresseRamassage: infos.adresse || undefined,
  };
};

const envoyerEmailsConfirmation = async (commande) => {
  const email = commande.user ? commande.user.email : commande.visiteurEmail;
  const nom = commande.user ? commande.user.name : commande.visiteurNom;

  try {
    const { envoyerEmailConfirmation } = await import('./email.service.js');
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
    console.error('❌ Erreur envoi email confirmation:', emailError.message || emailError);
  }

  try {
    const { envoyerEmailNotificationAdmin } = await import('./email.service.js');
    const ramassageExtras = await extrasEmailRamassage(commande);
    const result = await envoyerEmailNotificationAdmin({ commande, ...ramassageExtras });
    if (!result.success) {
      console.error('❌ Notification admin non envoyée:', result.message || result.error);
    }
  } catch (err) {
    console.error('❌ Erreur notification admin:', err.message || err);
  }
};

export const trouverCommandePourPaymentIntent = async (paymentIntent) => {
  const paymentIntentId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id;
  const intent = typeof paymentIntent === 'string'
    ? await stripe.paymentIntents.retrieve(paymentIntent)
    : paymentIntent;

  let commande = await Commande.findOne({ stripePaymentIntentId: intent.id });

  const commandeId = intent.metadata?.commandeId;
  if (!commande && commandeId && commandeId !== 'pending') {
    commande = await Commande.findById(commandeId);
  }

  return { commande, paymentIntent: intent };
};

export const finaliserCommandeApresPaiement = async (paymentIntentId) => {
  const { commande, paymentIntent } = await trouverCommandePourPaymentIntent(paymentIntentId);

  if (paymentIntent.status !== 'succeeded') {
    return {
      success: false,
      status: paymentIntent.status,
      message: 'Le paiement n\'a pas été complété',
    };
  }

  if (!commande) {
    console.error('❌ Paiement Stripe sans commande associée:', paymentIntentId);
    return {
      success: false,
      message: 'Aucune commande associée à ce paiement',
      paymentIntentId,
    };
  }

  await commande.populate('boites.saveurs.biscuit');
  if (commande.user) {
    await commande.populate('user', 'name email');
  }

  if (commande.paiementConfirme) {
    return {
      success: true,
      alreadyConfirmed: true,
      commande,
    };
  }

  commande.paiementConfirme = true;
  commande.statut = 'en_attente';
  commande.stripePaymentIntentId = paymentIntent.id;
  await commande.save();

  await envoyerEmailsConfirmation(commande);

  console.log('✅ Commande finalisée après paiement:', commande._id.toString(), paymentIntent.id);

  return {
    success: true,
    commande,
  };
};
