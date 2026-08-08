import crypto from 'crypto';

const TOKEN_VALIDITY_DAYS = 7;

export function genererTokenPaiement() {
  return crypto.randomBytes(32).toString('hex');
}

export function getExpirationTokenPaiement() {
  const expire = new Date();
  expire.setDate(expire.getDate() + TOKEN_VALIDITY_DAYS);
  return expire;
}

export function construireLienPaiement(commandeId, token) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/payer/${commandeId}?token=${encodeURIComponent(token)}`;
}

export function tokenPaiementValide(commande, token) {
  if (!commande?.tokenPaiement || !token) return false;
  if (commande.tokenPaiement !== token) return false;
  if (commande.paiementConfirme) return false;
  if (commande.tokenPaiementExpire && new Date() > new Date(commande.tokenPaiementExpire)) {
    return false;
  }
  return true;
}
