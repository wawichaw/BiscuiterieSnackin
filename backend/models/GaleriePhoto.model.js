import mongoose from 'mongoose';

const galeriePhotoSchema = new mongoose.Schema({
  image: {
    type: String, // Base64 ou URL
    required: true,
  },
  titre: {
    type: String,
    trim: true,
    maxlength: [255, 'Le titre ne peut pas dépasser 255 caractères'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La description ne peut pas dépasser 500 caractères'],
  },
  ordre: {
    type: Number,
    default: 0,
  },
  actif: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

const GaleriePhoto = mongoose.model('GaleriePhoto', galeriePhotoSchema);

export default GaleriePhoto;
