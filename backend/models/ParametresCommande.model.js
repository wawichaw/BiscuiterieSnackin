import mongoose from 'mongoose';

/**
 * Singleton : règles de délai pour les commandes (cutoff + marge avant ramassage).
 */
const parametresCommandeSchema = new mongoose.Schema({
  actif: {
    type: Boolean,
    default: true,
  },
  /** Après cette heure (HH:MM, fuseau Montréal), impossible de commander pour demain. */
  heureLimiteCommande: {
    type: String,
    default: '11:00',
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM requis'],
  },
  /** Minutes minimum entre la commande et le créneau de ramassage le jour même. */
  delaiMinimumMinutes: {
    type: Number,
    default: 60,
    min: [0, 'Le délai ne peut pas être négatif'],
    max: [1440, 'Le délai ne peut pas dépasser 24 h'],
  },
  /** Si true, impossible de commander pour le jour même (minimum = demain). */
  bloquerJourMeme: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  collection: 'parametrescommande',
});

const ParametresCommande = mongoose.model('ParametresCommande', parametresCommandeSchema);

export default ParametresCommande;
