import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import './Assistants.css';

const Assistants = () => {
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const charger = async () => {
    try {
      const res = await api.get('/users/assistants');
      setAssistants(res.data?.data?.assistants || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const res = await api.post('/users/assistants', {
        name: name.trim(),
        email: email.trim(),
      });
      
      const tempPassword = res.data?.data?.temporaryPassword;
      setGeneratedPassword(tempPassword || '');
      setShowPassword(true);
      
      setSuccess('Accès assistant créé avec mot de passe temporaire.');
      setName('');
      setEmail('');
      await charger();
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de créer l\'accès');
    } finally {
      setSaving(false);
    }
  };

  const revoquer = async (id, nom) => {
    if (!window.confirm(`Révoquer l'accès de ${nom} ?`)) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/users/assistants/${id}`);
      setSuccess('Accès révoqué');
      setAssistants((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de révoquer cet accès');
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    setSuccess('Mot de passe copié dans le presse-papier');
  };

  return (
    <div className="admin-assistants-page">
      <div className="assistants-header">
        <h1>Accès assistant</h1>
        <p>
          Un assistant peut voir les commandes et créer des liens de paiement.
          Il n'a pas accès au reste de l'admin (biscuits, tarifs, horaires, etc.).
        </p>
      </div>

      {error && <div className="assistants-alert error">{error}</div>}
      {success && <div className="assistants-alert success">{success}</div>}

      {showPassword && generatedPassword && (
        <div className="assistants-alert info">
          <strong>Mot de passe temporaire généré:</strong>
          <div className="password-display">
            <code>{generatedPassword}</code>
            <button type="button" className="btn-copy" onClick={copyPassword}>
              Copier
            </button>
          </div>
          <p className="password-info">
            Transmettez ce mot de passe à l'assistant. Il devra le changer lors de sa première connexion.
            Le mot de passe expire dans 7 jours.
          </p>
        </div>
      )}

      <form className="assistants-form" onSubmit={handleSubmit}>
        <h2>Créer un accès</h2>
        <label htmlFor="assistant-name">Nom</label>
        <input
          id="assistant-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <label htmlFor="assistant-email">Courriel</label>
        <input
          id="assistant-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Création…' : 'Créer l\'accès'}
        </button>
      </form>

      <section className="assistants-liste">
        <h2>Assistants existants</h2>
        {loading ? (
          <p>Chargement…</p>
        ) : assistants.length === 0 ? (
          <p className="assistants-vide">Aucun accès assistant pour le moment.</p>
        ) : (
          <ul>
            {assistants.map((a) => (
              <li key={a._id}>
                <div>
                  <strong>{a.name}</strong>
                  <span>{a.email}</span>
                </div>
                <button type="button" className="btn-revoquer" onClick={() => revoquer(a._id, a.name)}>
                  Révoquer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Assistants;