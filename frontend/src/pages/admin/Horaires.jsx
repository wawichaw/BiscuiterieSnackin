import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Horaires.css';

const AdminHoraires = () => {
  const [horaires, setHoraires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    pointRamassage: 'laval',
    date: '',
    heures: [''],
    disponible: true,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchHoraires();
  }, []);

  const fetchHoraires = async () => {
    try {
      const response = await api.get('/horaires/all');
      setHoraires(response.data.data.horaires);
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur lors du chargement des horaires');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHeure = () => {
    setFormData({
      ...formData,
      heures: [...formData.heures, ''],
    });
  };

  const handleRemoveHeure = (index) => {
    const newHeures = formData.heures.filter((_, i) => i !== index);
    setFormData({ ...formData, heures: newHeures });
  };

  const handleHeureChange = (index, value) => {
    const newHeures = [...formData.heures];
    newHeures[index] = value;
    setFormData({ ...formData, heures: newHeures });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Filtrer les heures vides
    const heuresValides = formData.heures.filter(h => h.trim() !== '');

    if (heuresValides.length === 0) {
      setError('Au moins une heure est requise');
      return;
    }

    // Valider le format des heures (HH:MM)
    const heureRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    for (const heure of heuresValides) {
      if (!heureRegex.test(heure)) {
        setError(`Format d'heure invalide: ${heure}. Utilisez le format HH:MM (ex: 10:00)`);
        return;
      }
    }

    try {
      await api.post('/horaires', {
        ...formData,
        heures: heuresValides,
      });

      setSuccess('Horaire créé/mis à jour avec succès !');
      setFormData({
        pointRamassage: 'laval',
        date: '',
        heures: [''],
        disponible: true,
      });
      setShowForm(false);
      fetchHoraires();
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la création de l\'horaire');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet horaire ?')) {
      return;
    }

    try {
      await api.delete(`/horaires/${id}`);
      setSuccess('Horaire supprimé avec succès !');
      fetchHoraires();
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const grouperParLieu = () => {
    const groupes = {};
    horaires.forEach(horaire => {
      if (!groupes[horaire.pointRamassage]) {
        groupes[horaire.pointRamassage] = [];
      }
      groupes[horaire.pointRamassage].push(horaire);
    });
    return groupes;
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  const groupes = grouperParLieu();
  const nomsLieux = {
    laval: 'Laval',
    montreal: 'Montréal',
    repentigny: 'Repentigny'
  };

  return (
    <div className="admin-horaires-page">
      <div className="admin-header">
        <h1>🕐 Gérer les horaires de ramassage</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Annuler' : '+ Ajouter un horaire'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <form className="horaire-form" onSubmit={handleSubmit}>
          <h2>Nouvel horaire</h2>

          <div className="form-row">
            <div className="form-group">
              <label>Point de ramassage *</label>
              <select
                value={formData.pointRamassage}
                onChange={(e) => setFormData({ ...formData, pointRamassage: e.target.value })}
                required
                className="form-select"
              >
                <option value="laval">Laval</option>
                <option value="montreal">Montréal</option>
                <option value="repentigny">Repentigny</option>
              </select>
            </div>

            <div className="form-group">
              <label>Date *</label>
              <input
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
            <label>Heures disponibles *</label>
            <small className="form-help">Format: HH:MM (ex: 10:00, 14:30)</small>
            {formData.heures.map((heure, index) => (
              <div key={index} className="heure-input-row">
                <input
                  type="text"
                  value={heure}
                  onChange={(e) => handleHeureChange(index, e.target.value)}
                  placeholder="10:00"
                  pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                  className="form-input heure-input"
                />
                {formData.heures.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveHeure(index)}
                    className="btn-remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddHeure}
              className="btn btn-secondary"
            >
              + Ajouter une heure
            </button>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.disponible}
                onChange={(e) => setFormData({ ...formData, disponible: e.target.checked })}
              />
              Disponible
            </label>
          </div>

          <button type="submit" className="btn btn-primary">
            Enregistrer
          </button>
        </form>
      )}

      <div className="horaires-list">
        {Object.keys(groupes).length === 0 ? (
          <p>Aucun horaire configuré</p>
        ) : (
          Object.keys(groupes).map(lieu => (
            <div key={lieu} className="lieu-section">
              <h2>{nomsLieux[lieu]}</h2>
              <div className="horaires-grid">
                {groupes[lieu].map((horaire) => (
                  <div key={horaire._id} className="horaire-card">
                    <div className="horaire-header">
                      <strong>
                        {new Date(horaire.date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </strong>
                      <span className={`badge ${horaire.disponible ? 'available' : 'unavailable'}`}>
                        {horaire.disponible ? 'Disponible' : 'Indisponible'}
                      </span>
                    </div>
                    <div className="horaire-heures">
                      {horaire.heures.map((heure, index) => (
                        <span key={index} className="heure-badge">{heure}</span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleDelete(horaire._id)}
                      className="btn btn-danger"
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminHoraires;

