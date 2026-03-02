import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './Login.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSent(false);

    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">🔑 Mot de passe oublié</h2>

        {error && (
          <div className="error-alert">
            <ul><li>{error}</li></ul>
          </div>
        )}

        {sent ? (
          <div className="success-message" style={{ marginBottom: '1rem', padding: '1rem', background: '#e8f5e9', borderRadius: '8px', color: '#2e7d32' }}>
            Si un compte existe avec cet email, un lien de réinitialisation a été envoyé. Vérifiez votre boîte de réception et les spams.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <p style={{ color: '#555', marginBottom: '1.25rem' }}>
              Entrez votre adresse email. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>
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
            <div className="form-actions">
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
              </button>
            </div>
          </form>
        )}

        <div className="form-links">
          <Link to="/login" className="form-link">
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
