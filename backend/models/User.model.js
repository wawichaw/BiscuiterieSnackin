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
      // Le mot de passe est requis seulement si l'utilisateur n'a pas de googleId et n'a pas de mot de passe temporaire
      return !this.googleId && !this.temporaryPassword;
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
    enum: ['user', 'admin', 'assistant'],
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
  temporaryPassword: {
    type: String,
    select: false,
  },
  forcePasswordChange: {
    type: Boolean,
    default: false,
  },
  temporaryPasswordExpires: {
    type: Date,
    select: false,
  },
}, {
  timestamps: true, // Ajoute createdAt et updatedAt automatiquement
});

// Hasher les mots de passe avant de sauvegarder
userSchema.pre('save', async function (next) {
  // Hasher le mot de passe principal si modifié
  if (this.isModified('password') && this.password) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  
  // Hasher le mot de passe temporaire si modifié
  if (this.isModified('temporaryPassword') && this.temporaryPassword) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.temporaryPassword = await bcrypt.hash(this.temporaryPassword, salt);
    } catch (error) {
      return next(error);
    }
  }
  
  next();
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false; // Pas de mot de passe (utilisateur Google uniquement)
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour comparer le mot de passe temporaire
userSchema.methods.compareTemporaryPassword = async function (candidatePassword) {
  if (!this.temporaryPassword) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.temporaryPassword);
};

const User = mongoose.model('User', userSchema);

export default User;

