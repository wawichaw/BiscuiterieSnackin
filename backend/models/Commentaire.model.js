import mongoose from 'mongoose';

const commentaireSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optionnel pour les commentaires anonymes
  },
  nom: {
    type: String,
    trim: true,
    maxlength: [255, 'Le nom ne peut pas dépasser 255 caractères'],
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
  },
  biscuit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Biscuit',
  },
  texte: {
    type: String,
    required: [true, 'Le texte est requis'],
    trim: true,
    maxlength: [1000, 'Le commentaire ne peut pas dépasser 1000 caractères'],
  },
  note: {
    type: Number,
    min: [1, 'La note doit être au moins 1'],
    max: [5, 'La note ne peut pas dépasser 5'],
  },
  photos: [{
    type: String, // URLs des photos (base64 ou URLs)
  }],
  approuve: {
    type: Boolean,
    default: false,
  },
  reponseAdmin: {
    texte: {
      type: String,
      trim: true,
      maxlength: [1000, 'La réponse ne peut pas dépasser 1000 caractères'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
}, {
  timestamps: true,
});

const Commentaire = mongoose.model('Commentaire', commentaireSchema);

export default Commentaire;

