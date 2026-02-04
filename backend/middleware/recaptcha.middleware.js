import axios from 'axios';

/**
 * Middleware pour vérifier le token reCAPTCHA v3
 * @param {number} minScore - Score minimum requis (0.0 à 1.0, défaut: 0.5)
 * @returns {Function} Middleware Express
 */
export const verifyRecaptcha = (minScore = 0.5) => {
  return async (req, res, next) => {
    // Si reCAPTCHA n'est pas configuré, passer sans vérification
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      return next();
    }

    const recaptchaToken = req.body.recaptchaToken;

    // Si pas de token reCAPTCHA, continuer quand même (pour compatibilité)
    // En production, tu peux changer ça pour retourner une erreur
    if (!recaptchaToken) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(400).json({
          success: false,
          message: 'Vérification reCAPTCHA requise',
        });
      }
      return next();
    }

    try {
      // Vérifier le token avec Google
      const response = await axios.post(
        'https://www.google.com/recaptcha/api/siteverify',
        null,
        {
          params: {
            secret: process.env.RECAPTCHA_SECRET_KEY,
            response: recaptchaToken,
          },
        }
      );

      const { success, score, action } = response.data;

      // Vérifier que la vérification a réussi
      if (!success) {
        return res.status(400).json({
          success: false,
          message: 'Échec de la vérification reCAPTCHA',
        });
      }

      // Vérifier le score (0.0 = bot probable, 1.0 = humain probable)
      if (score < minScore) {
        console.warn(`reCAPTCHA score trop bas: ${score} (minimum: ${minScore})`);
        return res.status(403).json({
          success: false,
          message: 'Activité suspecte détectée. Veuillez réessayer.',
        });
      }

      // Ajouter les infos reCAPTCHA à la requête pour debug
      req.recaptcha = {
        score,
        action,
        success: true,
      };

      next();
    } catch (error) {
      console.error('Erreur lors de la vérification reCAPTCHA:', error);
      
      // En développement, continuer même en cas d'erreur
      if (process.env.NODE_ENV === 'development') {
        return next();
      }

      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification reCAPTCHA',
      });
    }
  };
};
