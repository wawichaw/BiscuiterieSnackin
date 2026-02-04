import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    // Utiliser l'URI du .env ou localhost par défaut
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/snackin';
    
    // Masquer le mot de passe dans les logs (pour la sécurité)
    const uriForLog = uri.includes('mongodb+srv://') 
      ? uri.replace(/mongodb\+srv:\/\/[^:]+:[^@]+@/, 'mongodb+srv://***:***@')
      : uri;
    
    console.log('🔌 Tentative de connexion à MongoDB...');
    console.log('📍 URI:', uriForLog);

    await mongoose.connect(uri);
    
    const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1');
    console.log(`✅ Connecté à MongoDB ${isLocal ? 'local' : 'Atlas'} avec succès`);
    console.log('📊 Base de données:', mongoose.connection.name);
  } catch (error) {
    console.error('\n❌ Erreur de connexion à MongoDB');
    console.error('Message:', error.message);
    
    // Messages d'aide selon le type d'erreur
    if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
      console.error('\n💡 Solutions possibles:');
      console.error('1. Vérifiez que le mot de passe dans MONGODB_URI est correct');
      console.error('2. Si votre mot de passe contient des caractères spéciaux (@, #, $, etc.), encodez-les en URL:');
      console.error('   - @ devient %40');
      console.error('   - # devient %23');
      console.error('   - $ devient %24');
      console.error('3. Vérifiez que l\'utilisateur existe dans MongoDB Atlas');
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
      console.error('\n💡 MongoDB local n\'est pas démarré');
      console.error('Démarrez MongoDB avec: mongod');
      console.error('Ou utilisez MongoDB Atlas en définissant MONGODB_URI dans le .env');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n💡 Problème de connexion réseau');
      console.error('Vérifiez votre connexion internet et que le cluster MongoDB Atlas est accessible');
    }
    
    process.exit(1);
  }
};

export default connectDB;

