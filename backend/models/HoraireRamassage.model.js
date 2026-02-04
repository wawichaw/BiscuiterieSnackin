import mongoose from 'mongoose';

const horaireRamassageSchema = new mongoose.Schema({
  pointRamassage: {
    type: String,
    enum: ['laval', 'montreal', 'repentigny'],
    required: true,
  },
  date: {
    type: Date,
    required: true,
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

// Index pour éviter les doublons
horaireRamassageSchema.index({ pointRamassage: 1, date: 1 }, { unique: true });

const HoraireRamassage = mongoose.model('HoraireRamassage', horaireRamassageSchema);

export default HoraireRamassage;

