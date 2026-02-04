/**
 * Script pour transformer un utilisateur existant en admin
 * Utilisation: node make-admin.js EMAIL
 * Exemple: node make-admin.js admin@example.com
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.model.js';

dotenv.config();

const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: node make-admin.js EMAIL');
  console.error('Exemple: node make-admin.js admin@example.com');
  process.exit(1);
}

async function makeAdmin() {
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

    // Transformer en admin
    user.isAdmin = true;
    user.role = 'admin';
    await user.save();

    console.log('✅ Utilisateur transformé en administrateur !');
    console.log(`   Email: ${user.email}`);
    console.log(`   Nom: ${user.name}`);
    console.log(`   Rôle: ${user.role}`);
    console.log(`   Admin: ${user.isAdmin}`);

    await mongoose.connection.close();
    console.log('\n🎉 Terminé !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

makeAdmin();

