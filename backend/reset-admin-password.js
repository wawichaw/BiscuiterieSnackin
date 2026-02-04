/**
 * Script pour réinitialiser le mot de passe d'un admin
 * Utilisation: node reset-admin-password.js EMAIL NOUVEAU_MOT_DE_PASSE
 * Exemple: node reset-admin-password.js snackin.mtl@gmail.com admin123456
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './models/User.model.js';

dotenv.config();

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('❌ Usage: node reset-admin-password.js EMAIL NOUVEAU_MOT_DE_PASSE');
  console.error('Exemple: node reset-admin-password.js snackin.mtl@gmail.com admin123456');
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error('❌ Le mot de passe doit contenir au moins 8 caractères');
  process.exit(1);
}

async function resetPassword() {
  try {
    // Connexion à MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/snackin';
    await mongoose.connect(uri);
    console.log('✅ Connecté à MongoDB\n');

    // Trouver l'utilisateur
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email: ${email}`);
      process.exit(1);
    }

    // Hasher le nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Mettre à jour le mot de passe
    user.password = hashedPassword;
    await user.save();

    console.log('✅ Mot de passe réinitialisé avec succès !');
    console.log(`   Email: ${user.email}`);
    console.log(`   Nom: ${user.name}`);
    console.log(`   Rôle: ${user.role}`);
    console.log(`   Admin: ${user.isAdmin}`);
    console.log(`\n🔑 Nouveau mot de passe: ${newPassword}`);
    console.log('   ⚠️  Notez-le bien, vous en aurez besoin pour vous connecter !\n');

    await mongoose.connection.close();
    console.log('🎉 Terminé !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

resetPassword();

