import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRecaptcha } from '../hooks/useRecaptcha';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const googleButtonRef = useRef(null);
  const { executeRecaptcha } = useRecaptcha();
  const successMessage = location.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Exécuter reCAPTCHA avant la connexion
    const recaptchaToken = await executeRecaptcha('login');
    
    const result = await login(email, password, recaptchaToken);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Erreur de connexion');
    }

    setLoading(false);
  };

  useEffect(() => {
    // Attendre que Google Identity Services soit chargé
    const initGoogleSignIn = () => {
      if (window.google && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        try {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: handleGoogleSignIn,
          });

          if (googleButtonRef.current) {
            window.google.accounts.id.renderButton(
              googleButtonRef.current,
              {
                theme: 'outline',
                size: 'large',
                width: 300,
                text: 'signin_with',
                locale: 'fr',
              }
            );
          }
        } catch (err) {
          console.error('Erreur lors de l\'initialisation Google Sign-In:', err);
        }
      }
    };

    // Si Google est déjà chargé
    if (window.google) {
      initGoogleSignIn();
    } else {
      // Attendre que le script Google soit chargé
      const checkGoogle = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogle);
          initGoogleSignIn();
        }
      }, 100);

      // Timeout après 5 secondes
      setTimeout(() => {
        clearInterval(checkGoogle);
        if (!window.google) {
          console.warn('Google Identity Services n\'a pas pu être chargé');
        }
      }, 5000);
    }
  }, []);

  const handleGoogleSignIn = async (response) => {
    setError('');
    setLoading(true);

    const result = await loginGoogle(response.credential);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Erreur de connexion Google');
    }

    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">🔐 Se connecter</h2>

        {successMessage && (
          <div className="success-alert" style={{ marginBottom: '1rem', padding: '1rem', background: '#e8f5e9', borderRadius: '8px', color: '#2e7d32' }}>
            {successMessage}
          </div>
        )}

        {error && (
          <div className="error-alert">
            <ul>
              <li>{error}</li>
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Connexion...' : '✨ Se connecter'}
            </button>

            {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
              <>
                <div style={{ margin: '1rem 0', textAlign: 'center', color: '#666' }}>
                  ou
                </div>
                <div ref={googleButtonRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}></div>
              </>
            )}

            <div className="form-links">
              <Link to="/forgot-password" className="form-link">
                Mot de passe oublié ?
              </Link>
              <br />
              <Link to="/register" className="form-link">
                Pas encore de compte ? S'inscrire
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

