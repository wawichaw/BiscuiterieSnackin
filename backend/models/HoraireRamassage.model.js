import mongoose from 'mongoose';

const horaireRamassageSchema = new mongoose.Schema({
  pointRamassage: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  ville: {
    type: String,
    required: true,
    trim: true,
  },
  adresse: {
    type: String,
    required: true,
    trim: true,
  },
  /** @deprecated — anciennes entrées à date fixe ; préférer joursSemaine */
  date: {
    type: Date,
    required: false,
  },
  /** 0 = dimanche … 6 = samedi */
  joursSemaine: {
    type: [Number],
    default: [],
  },
  heureDebut: {
    type: String,
    trim: true,
  },
  heureFin: {
    type: String,
    trim: true,
  },
  intervalleMinutes: {
    type: Number,
    default: 30,
  },
  heures: [{
    type: String,
    required: true,
  }],
  disponible: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

horaireRamassageSchema.index({ pointRamassage: 1 }, { unique: true });

const HoraireRamassage = mongoose.model('HoraireRamassage', horaireRamassageSchema);

export default HoraireRamassage;
