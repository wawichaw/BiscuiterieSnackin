import { verifyToken } from '../config/jwt.js';

export const authenticate = async (req, res, next) => {
  try {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification manquant',
      });
    }

    const token = authHeader.substring(7); // Enlever "Bearer "

    // Vérifier le token
    const decoded = verifyToken(token);
    
    // Ajouter l'ID de l'utilisateur à la requête
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Token invalide',
    });
  }
};

export const isAdmin = async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur est authentifié
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise. Veuillez vous connecter.',
      });
    }

    // Cette fonction nécessite que authenticate soit appelé avant
    const User = (await import('../models/User.model.js')).default;
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé.',
      });
    }

    if (!user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Administrateur requis.',
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Erreur isAdmin middleware:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des permissions',
    });
  }
};

