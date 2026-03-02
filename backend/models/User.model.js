import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    maxlength: [255, 'Le nom ne peut pas dépasser 255 caractères'],
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
  },
  password: {
    type: String,
    required: function() {
      // Le mot de passe est requis seulement si l'utilisateur n'a pas de googleId
      return !this.googleId;
    },
    minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
    select: false, // Ne pas retourner le mot de passe par défaut
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Permet plusieurs null mais un seul googleId unique
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  resetPasswordToken: {
    type: String,
    select: false,
  },
  resetPasswordExpires: {
    type: Date,
    select: false,
  },
}, {
  timestamps: true, // Ajoute createdAt et updatedAt automatiquement
});

// Hasher le mot de passe avant de sauvegarder (seulement si password existe)
userSchema.pre('save', async function (next) {
  // Ne hasher que si le mot de passe a été modifié et existe
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false; // Pas de mot de passe (utilisateur Google uniquement)
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;

