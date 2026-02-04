import mongoose from 'mongoose';

const biscuitSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  prix: {
    type: Number,
    required: [true, 'Le prix est requis'],
    min: [0, 'Le prix ne peut pas être négatif'],
  },
  image: {
    type: String,
    default: '',
  },
  saveur: {
    type: String,
    trim: true,
  },
  disponible: {
    type: Boolean,
    default: true,
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Le stock ne peut pas être négatif'],
  },
}, {
  timestamps: true,
});

const Biscuit = mongoose.model('Biscuit', biscuitSchema);

export default Biscuit;

