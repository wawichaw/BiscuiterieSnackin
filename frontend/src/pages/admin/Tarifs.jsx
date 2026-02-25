import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Tarifs.css';

const TAILLES = [4, 6, 12];

const AdminTarifs = () => {
  const [prixBoites, setPrixBoites] = useState({ 4: 15, 6: 20, 12: 35 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchTarifs();
  }, []);

  const fetchTarifs = async () => {
    try {
      const response = await api.get('/tarifs/boites');
      const prix = response.data?.data?.prixBoites;
      if (prix && typeof prix[4] === 'number' && typeof prix[6] === 'number' && typeof prix[12] === 'number') {
        setPrixBoites({ 4: prix[4], 6: prix[6], 12: prix[12] });
      }
    } catch (err) {
      console.error('Erreur chargement tarifs:', err);
      setError('Erreur lors du chargement des prix');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (taille, value) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setPrixBoites(prev => ({ ...prev, [taille]: num }));
    } else if (value === '' || value === '.') {
      setPrixBoites(prev => ({ ...prev, [taille]: 0 }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await api.put('/tarifs/boites', {
        prix4: prixBoites[4],
        prix6: prixBoites[6],
        prix12: prixBoites[12],
      });
      setSuccess('Prix des boîtes enregistrés avec succès !');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="admin-tarifs-page">
      <div className="admin-header">
        <h1>💰 Prix des boîtes</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form className="tarifs-form" onSubmit={handleSubmit}>
        <p className="tarifs-description">
          Les prix s'appliquent aux boîtes de 4, 6 et 12 biscuits sur la page Commander.
        </p>
        <div className="tarifs-grid">
          {TAILLES.map(taille => (
            <div key={taille} className="tarif-card">
              <label className="tarif-label">Boîte de {taille} biscuits</label>
              <div className="tarif-input-wrap">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={prixBoites[taille]}
                  onChange={(e) => handleChange(taille, e.target.value)}
                  className="tarif-input"
                />
                <span className="tarif-suffix">$</span>
              </div>
            </div>
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer les prix'}
        </button>
      </form>
    </div>
  );
};

export default AdminTarifs;
