import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Horaires.css';

const defaultForm = {
  ville: '',
  adresse: '',
  date: '',
  heureDebut: '10:00',
  heureFin: '18:00',
  intervalleMinutes: 30,
  disponible: true,
};

const AdminHoraires = () => {
  const [horaires, setHoraires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchHoraires();
  }, []);

  const fetchHoraires = async () => {
    try {
      const response = await api.get('/horaires/all');
      setHoraires(response.data.data.horaires);
    } catch (err) {
      console.error('Erreur:', err);
      setError('Erreur lors du chargement des horaires');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.heureFin <= formData.heureDebut) {
      setError('L\'heure de fin doit être après l\'heure de début');
      return;
    }

    try {
      await api.post('/horaires', formData);
      setSuccess('Plage horaire enregistrée avec succès !');
      setFormData(defaultForm);
      setShowForm(false);
      fetchHoraires();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette plage horaire ?')) return;
    try {
      await api.delete(`/horaires/${id}`);
      setSuccess('Horaire supprimé.');
      fetchHoraires();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="admin-horaires-page">
      <div className="admin-header">
        <h1>🕐 Horaires de ramassage</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Annuler' : '+ Ajouter une plage'}
        </button>
      </div>

      <p className="horaires-intro">
        Définissez une date, une plage horaire, la ville et l&apos;adresse de pick-up.
        Les créneaux sont générés automatiquement pour les clients.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <form className="horaire-form" onSubmit={handleSubmit}>
          <h2>Nouvelle plage de ramassage</h2>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ville">Ville *</label>
              <input
                id="ville"
                type="text"
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                placeholder="Ex: Laval"
                required
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="date">Date *</label>
              <input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                required
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="adresse">Adresse de ramassage *</label>
            <input
              id="adresse"
              type="text"
              value={formData.adresse}
              onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              placeholder="Ex: 123 rue Principale, Laval H7X 1A1"
              required
              className="form-input"
            />
          </div>

          <div className="form-row form-row-three">
            <div className="form-group">
              <label htmlFor="heureDebut">Heure de début *</label>
              <input
                id="heureDebut"
                type="time"
                value={formData.heureDebut}
                onChange={(e) => setFormData({ ...formData, heureDebut: e.target.value })}
                required
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="heureFin">Heure de fin *</label>
              <input
                id="heureFin"
                type="time"
                value={formData.heureFin}
                onChange={(e) => setFormData({ ...formData, heureFin: e.target.value })}
                required
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="intervalle">Créneaux tous les</label>
              <select
                id="intervalle"
                value={formData.intervalleMinutes}
                onChange={(e) =>
                  setFormData({ ...formData, intervalleMinutes: Number(e.target.value) })
                }
                className="form-select"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.disponible}
                onChange={(e) => setFormData({ ...formData, disponible: e.target.checked })}
              />
              {' '}Disponible pour les commandes
            </label>
          </div>

          <button type="submit" className="btn btn-primary">
            Enregistrer la plage
          </button>
        </form>
      )}

      <div className="horaires-list">
        {horaires.length === 0 ? (
          <p className="horaires-empty">Aucun horaire configuré. Ajoutez une première plage ci-dessus.</p>
        ) : (
          <div className="horaires-grid">
            {horaires.map((horaire) => (
              <div key={horaire._id} className="horaire-card">
                <div className="horaire-header">
                  <strong>{formatDate(horaire.date)}</strong>
                  <span className={`badge ${horaire.disponible ? 'available' : 'unavailable'}`}>
                    {horaire.disponible ? 'Disponible' : 'Indisponible'}
                  </span>
                </div>
                <p className="horaire-lieu">
                  <strong>{horaire.ville}</strong>
                  {horaire.adresse && <span className="horaire-adresse">{horaire.adresse}</span>}
                </p>
                {(horaire.heureDebut && horaire.heureFin) && (
                  <p className="horaire-plage">
                    Plage : {horaire.heureDebut} – {horaire.heureFin}
                    {horaire.intervalleMinutes ? ` (tous les ${horaire.intervalleMinutes} min)` : ''}
                  </p>
                )}
                <div className="horaire-heures">
                  {horaire.heures.map((heure) => (
                    <span key={heure} className="heure-badge">{heure}</span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(horaire._id)}
                  className="btn btn-danger"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminHoraires;
