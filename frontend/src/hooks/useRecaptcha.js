import { useEffect, useRef } from 'react';

/**
 * Hook pour utiliser Google reCAPTCHA v3
 * @returns {Function} Fonction pour exécuter reCAPTCHA et obtenir un token
 */
export const useRecaptcha = () => {
  const recaptchaLoaded = useRef(false);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

    if (!siteKey) {
      console.warn('reCAPTCHA Site Key non configurée');
      return;
    }

    // Charger le script reCAPTCHA si pas déjà chargé
    if (!scriptLoaded.current && !window.grecaptcha) {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        scriptLoaded.current = true;
      };
      document.head.appendChild(script);
    }

    // Attendre que reCAPTCHA soit chargé
    const checkRecaptcha = () => {
      if (window.grecaptcha && window.grecaptcha.ready) {
        recaptchaLoaded.current = true;
      }
    };

    // Vérifier immédiatement
    checkRecaptcha();

    // Vérifier périodiquement si pas encore chargé
    const interval = setInterval(() => {
      checkRecaptcha();
      if (recaptchaLoaded.current) {
        clearInterval(interval);
      }
    }, 100);

    // Timeout après 10 secondes
    setTimeout(() => {
      clearInterval(interval);
    }, 10000);
  }, []);

  /**
   * Exécute reCAPTCHA et retourne un token
   * @param {string} action - Action à protéger (ex: 'login', 'register', 'comment')
   * @returns {Promise<string|null>} Token reCAPTCHA ou null si erreur
   */
  const executeRecaptcha = async (action = 'submit') => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

    if (!siteKey) {
      console.warn('reCAPTCHA Site Key non configurée');
      return null;
    }

    try {
      if (!window.grecaptcha || !window.grecaptcha.ready) {
        console.warn('reCAPTCHA non chargé');
        return null;
      }

      return new Promise((resolve) => {
        window.grecaptcha.ready(() => {
          window.grecaptcha
            .execute(siteKey, { action })
            .then((token) => {
              resolve(token);
            })
            .catch((error) => {
              console.error('Erreur reCAPTCHA:', error);
              resolve(null);
            });
        });
      });
    } catch (error) {
      console.error('Erreur lors de l\'exécution reCAPTCHA:', error);
      return null;
    }
  };

  return { executeRecaptcha };
};
