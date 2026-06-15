import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Horaires.css';

const JOURS_SEMAINE = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' },
];

const defaultForm = {
  ville: '',
  adresse: '',
  joursSemaine: [],
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
      const list = response.data.data.horaires || [];
      setHoraires(list);
      if (list.length === 0) {
        setShowForm(true);
      }
    } catch (err) {
      console.error('Erreur:', err);
      setError('Erreur lors du chargement des horaires');
    } finally {
      setLoading(false);
    }
  };

  const toggleJour = (jour) => {
    setFormData((prev) => {
      const selected = prev.joursSemaine.includes(jour)
        ? prev.joursSemaine.filter((j) => j !== jour)
        : [...prev.joursSemaine, jour];
      return { ...prev, joursSemaine: selected.sort((a, b) => a - b) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.joursSemaine.length === 0) {
      setError('Sélectionnez au moins un jour de la semaine');
      return;
    }

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
    new Date(`${dateStr}T12:00:00`).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  const hasHoraires = horaires.length > 0;
  const formVisible = showForm || !hasHoraires;

  return (
    <div className="admin-horaires-page">
      <div className="admin-header">
        <h1>🕐 Horaires de ramassage</h1>
        {hasHoraires && (
          <button
            type="button"
            className="btn btn-primary btn-add-plage"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Annuler' : '+ Ajouter une plage'}
          </button>
        )}
      </div>

      <p className="horaires-intro">
        Choisissez les jours de la semaine (ex. mercredi et samedi), la plage horaire,
        la ville et l&apos;adresse de pick-up. Les dates concrètes de la semaine en cours
        sont calculées automatiquement pour vos clients.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {!formVisible && (
        <div className="horaires-actions">
          <button
            type="button"
            className="btn btn-primary btn-add-plage"
            onClick={() => setShowForm(true)}
          >
            + Ajouter une plage horaire
          </button>
        </div>
      )}

      {formVisible && (
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

          <div className="form-group">
            <label>Jours de ramassage *</label>
            <p className="form-help">Les clients verront les prochaines dates correspondantes (cette semaine et les suivantes).</p>
            <div className="jours-semaine-grid">
              {JOURS_SEMAINE.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`jour-btn ${formData.joursSemaine.includes(value) ? 'active' : ''}`}
                  onClick={() => toggleJour(value)}
                  aria-pressed={formData.joursSemaine.includes(value)}
                >
                  {label}
                </button>
              ))}
            </div>
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
        {!hasHoraires && !formVisible ? (
          <div className="horaires-empty">
            <p>Aucun horaire configuré pour le moment.</p>
            <button
              type="button"
              className="btn btn-primary btn-add-plage"
              onClick={() => setShowForm(true)}
            >
              + Ajouter ma première plage
            </button>
          </div>
        ) : !hasHoraires ? null : (
          <div className="horaires-grid">
            {horaires.map((horaire) => (
              <div key={horaire._id} className="horaire-card">
                <div className="horaire-header">
                  <strong>
                    {horaire.joursSemaineLabel
                      || (horaire.date ? formatDate(horaire.date.split('T')[0]) : 'Horaire')}
                  </strong>
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
                {horaire.prochainesDates?.length > 0 && (
                  <div className="horaire-prochaines-dates">
                    <span className="horaire-prochaines-label">Prochaines dates :</span>
                    {horaire.prochainesDates.slice(0, 4).map((d) => (
                      <span key={d} className="date-preview-badge">{formatDate(d)}</span>
                    ))}
                  </div>
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
