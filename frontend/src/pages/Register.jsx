import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRecaptcha } from '../hooks/useRecaptcha';
import { loadGoogleGsi } from '../utils/loadGoogleGsi';
import './Register.css';

const Register = () => {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { register, loginGoogle } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const { executeRecaptcha } = useRecaptcha();

  // Pré-remplir les champs depuis l'URL si disponibles
  useEffect(() => {
    const urlEmail = searchParams.get('email');
    const urlNom = searchParams.get('nom');
    if (urlEmail) setEmail(urlEmail);
    if (urlNom) setName(urlNom);
  }, [searchParams]);

  const handleGoogleSignIn = async (response) => {
    setError('');
    setErrors({});
    setLoading(true);

    const result = await loginGoogle(response.credential);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Erreur de connexion Google');
    }

    setLoading(false);
  };

  const googleSignInCallbackRef = useRef(handleGoogleSignIn);
  googleSignInCallbackRef.current = handleGoogleSignIn;

  useEffect(() => {
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return undefined;

    let cancelled = false;

    const initGoogleSignIn = () => {
      if (!window.google?.accounts?.id) return;
      try {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: (resp) => googleSignInCallbackRef.current(resp),
        });

        if (googleButtonRef.current) {
          window.google.accounts.id.renderButton(
            googleButtonRef.current,
            {
              theme: 'outline',
              size: 'large',
              width: 300,
              text: 'signup_with',
              locale: 'fr',
            }
          );
        }
      } catch (err) {
        console.error('Erreur lors de l\'initialisation Google Sign-In:', err);
      }
    };

    loadGoogleGsi()
      .then(() => {
        if (!cancelled) initGoogleSignIn();
      })
      .catch(() => {
        console.warn('Google Identity Services n\'a pas pu être chargé');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrors({});

    if (password !== passwordConfirmation) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    // Exécuter reCAPTCHA avant l'inscription
    const recaptchaToken = await executeRecaptcha('register');

    const result = await register(name, email, password, passwordConfirmation, recaptchaToken);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Erreur d\'inscription');
      if (result.errors) {
        setErrors(result.errors);
      }
    }

    setLoading(false);
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h2 className="register-title">✨ S'inscrire</h2>

        {error && (
          <div className="error-alert">
            <ul>
              <li>{error}</li>
            </ul>
          </div>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="error-alert">
            <ul>
              {Object.values(errors).flat().map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label htmlFor="name">Nom</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
              minLength={8}
              className="form-input"
            />
            <small>Minimum 8 caractères</small>
          </div>

          <div className="form-group">
            <label htmlFor="password_confirmation">Confirmer le mot de passe</label>
            <input
              id="password_confirmation"
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Inscription...' : "S'inscrire"}
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
              <Link to="/login" className="form-link">
                Déjà un compte ? Se connecter
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;

