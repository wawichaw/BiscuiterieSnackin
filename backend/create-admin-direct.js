/**
 * Script pour créer un admin directement dans MongoDB
 * Utilisation: node create-admin-direct.js
 * 
 * Ce script crée un admin avec des valeurs par défaut que vous pouvez modifier
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.model.js';

dotenv.config();

async function createAdminDirect() {
  try {
    // Connexion à MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/snackin';
    await mongoose.connect(uri);
    console.log('✅ Connecté à MongoDB\n');

    // ⚙️ MODIFIEZ CES VALEURS SELON VOS BESOINS
    const adminData = {
      name: 'Admin Snackin',
      email: 'admin@snackin.com',
      password: 'admin123456', // ⚠️ Changez ce mot de passe !
      role: 'admin',
      isAdmin: true,
    };

    // Vérifier si l'admin existe déjà
    const existing = await User.findOne({ email: adminData.email });
    if (existing) {
      console.log(`⚠️  Un utilisateur avec l'email "${adminData.email}" existe déjà.`);
      console.log('   Utilisez make-admin.js pour le transformer en admin.');
      process.exit(1);
    }

    // Créer l'admin directement dans MongoDB (le modèle va hasher le mot de passe automatiquement)
    const admin = await User.create({
      name: adminData.name,
      email: adminData.email,
      password: adminData.password, // Le modèle va hasher ce mot de passe
      role: adminData.role,
      isAdmin: adminData.isAdmin,
    });

    console.log('✅ Administrateur créé directement dans MongoDB !');
    console.log(`   ID: ${admin._id}`);
    console.log(`   Nom: ${admin.name}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Rôle: ${admin.role}`);
    console.log(`   Admin: ${admin.isAdmin}`);
    console.log(`\n⚠️  Mot de passe par défaut: ${adminData.password}`);
    console.log('   ⚠️  CHANGEZ-LE APRÈS LA PREMIÈRE CONNEXION !\n');

    await mongoose.connection.close();
    console.log('🎉 Terminé !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

createAdminDirect();

