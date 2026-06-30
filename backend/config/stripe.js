import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) {
  console.error('❌ ERREUR CRITIQUE: STRIPE_SECRET_KEY n\'est pas configurée !');
  throw new Error('STRIPE_SECRET_KEY est requise pour le fonctionnement de l\'application');
}
if (secretKey.startsWith('pk_')) {
  console.error('❌ ERREUR: STRIPE_SECRET_KEY ne doit pas être la clé publique (pk_...).');
  throw new Error('STRIPE_SECRET_KEY doit être la clé secrète (sk_...), pas la clé publique (pk_...)');
}

const stripe = new Stripe(secretKey);

export default stripe;
