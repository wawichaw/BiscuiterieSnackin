import mongoose from 'mongoose';

// Saveur dans une boîte
const saveurBoiteSchema = new mongoose.Schema({
  biscuit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Biscuit',
    required: true,
  },
  quantite: {
    type: Number,
    required: true,
    min: [1, 'La quantité doit être au moins 1'],
  },
});

// Boîte de biscuits
const boiteSchema = new mongoose.Schema({
  taille: {
    type: Number,
    enum: [4, 6, 12],
    required: true,
  },
  prix: {
    type: Number,
    required: true,
  },
  saveurs: [saveurBoiteSchema], // Les saveurs choisies dans cette boîte
});

const commandeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optionnel pour les commandes en mode visiteur
  },
  // Informations pour les commandes en mode visiteur
  visiteurNom: {
    type: String,
    required: function() {
      return !this.user; // Requis si pas d'utilisateur
    },
  },
  visiteurEmail: {
    type: String,
    required: function() {
      return !this.user; // Requis si pas d'utilisateur
    },
    lowercase: true,
    trim: true,
  },
  visiteurTelephone: {
    type: String,
    required: false,
  },
  boites: [boiteSchema], // Les boîtes commandées
  total: {
    type: Number,
    required: true,
    min: [0, 'Le total ne peut pas être négatif'],
  },
  statut: {
    type: String,
    enum: ['en_attente', 'en_traitement', 'completee'],
    default: 'en_attente',
  },
  typeReception: {
    type: String,
    enum: ['ramassage', 'livraison'],
    required: true,
  },
  // Pour le ramassage
  pointRamassage: {
    type: String,
    enum: ['laval', 'montreal', 'repentigny'],
    required: function() {
      return this.typeReception === 'ramassage';
    },
  },
  dateRamassage: {
    type: Date,
    required: function() {
      return this.typeReception === 'ramassage';
    },
  },
  heureRamassage: {
    type: String,
    required: function() {
      return this.typeReception === 'ramassage';
    },
  },
  // Pour la livraison
  villeLivraison: {
    type: String,
    enum: ['montreal', 'laval', 'repentigny', 'assomption', 'terrebonne'],
    required: function() {
      return this.typeReception === 'livraison';
    },
  },
  adresseLivraison: {
    rue: {
      type: String,
      required: function() {
        return this.typeReception === 'livraison';
      },
    },
    codePostal: {
      type: String,
      required: function() {
        return this.typeReception === 'livraison';
      },
    },
    instructions: {
      type: String,
      required: false,
    },
  },
  dateLivraison: {
    type: Date,
    required: function() {
      return this.typeReception === 'livraison';
    },
  },
  heureLivraison: {
    type: String,
    required: function() {
      return this.typeReception === 'livraison';
    },
  },
  fraisLivraison: {
    type: Number,
    default: 0,
    min: 0,
  },
  methodePaiement: {
    type: String,
    enum: ['sur_place', 'en_ligne'],
    required: true,
  },
  paiementConfirme: {
    type: Boolean,
    default: false,
  },
  stripePaymentIntentId: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

const Commande = mongoose.model('Commande', commandeSchema);

export default Commande;

