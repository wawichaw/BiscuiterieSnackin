import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './ChangePassword.css';

const ChangePassword = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      setLoading(false);
      return;
    }

    try {
      const res = await api.post('/auth/change-password', {
        oldPassword,
        newPassword,
        newPassword_confirmation: confirmPassword,
      });

      if (res.data.success) {
        setSuccess('Mot de passe modifié avec succès. Redirection...');
        
        // Update the token in localStorage
        localStorage.setItem('token', res.data.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.data.user));

        // Redirect after a short delay
        setTimeout(() => {
          navigate('/admin/commandes');
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de modifier le mot de passe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-page">
      <div className="change-password-container">
        <h1>Changer votre mot de passe</h1>
        <p className="subtitle">
          Pour votre sécurité, vous devez changer votre mot de passe temporaire lors de votre première connexion.
        </p>

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <form className="change-password-form" onSubmit={handleSubmit}>
          <label htmlFor="old-password">Mot de passe actuel</label>
          <input
            id="old-password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            placeholder="Entrez votre mot de passe actuel"
          />

          <label htmlFor="new-password">Nouveau mot de passe</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Minimum 8 caractères"
          />

          <label htmlFor="confirm-password">Confirmer le nouveau mot de passe</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Confirmez votre nouveau mot de passe"
          />

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Modification…' : 'Changer le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;