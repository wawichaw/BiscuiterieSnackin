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
  date: {
    type: Date,
    required: true,
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

horaireRamassageSchema.index({ pointRamassage: 1, date: 1 }, { unique: true });

const HoraireRamassage = mongoose.model('HoraireRamassage', horaireRamassageSchema);

export default HoraireRamassage;
