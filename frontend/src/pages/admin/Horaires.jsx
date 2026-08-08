import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Horaires.css';

const JOURS_SEMAINE = [
  { value: 1, label: 'Lun', fullLabel: 'Lundi' },
  { value: 2, label: 'Mar', fullLabel: 'Mardi' },
  { value: 3, label: 'Mer', fullLabel: 'Mercredi' },
  { value: 4, label: 'Jeu', fullLabel: 'Jeudi' },
  { value: 5, label: 'Ven', fullLabel: 'Vendredi' },
  { value: 6, label: 'Sam', fullLabel: 'Samedi' },
  { value: 0, label: 'Dim', fullLabel: 'Dimanche' },
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

const genererHeuresLocales = (heureDebut, heureFin, intervalleMinutes = 30) => {
  const parse = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const format = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const start = parse(heureDebut);
  const end = parse(heureFin);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return [];
  }

  const heures = [];
  for (let t = start; t <= end; t += intervalleMinutes) {
    heures.push(format(t));
  }
  return heures.length ? heures : [heureDebut];
};

const trierHeures = (heures = []) => [...new Set(heures)].sort((a, b) => a.localeCompare(b));

const defaultRegles = {
  actif: true,
  heureLimiteCommande: '11:00',
  delaiMinimumMinutes: 60,
};

const AdminHoraires = () => {
  const [horaires, setHoraires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regles, setRegles] = useState(defaultRegles);
  const [savingRegles, setSavingRegles] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [heuresManuelles, setHeuresManuelles] = useState(() =>
    genererHeuresLocales(defaultForm.heureDebut, defaultForm.heureFin, defaultForm.intervalleMinutes),
  );
  const [nouvelleHeure, setNouvelleHeure] = useState('12:00');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchHoraires();
    fetchRegles();
  }, []);

  const fetchRegles = async () => {
    try {
      const response = await api.get('/horaires/regles-commande');
      const p = response.data?.data?.parametres;
      if (p) {
        setRegles({
          actif: p.actif ?? defaultRegles.actif,
          heureLimiteCommande: p.heureLimiteCommande ?? defaultRegles.heureLimiteCommande,
          delaiMinimumMinutes: p.delaiMinimumMinutes ?? defaultRegles.delaiMinimumMinutes,
        });
      }
    } catch (err) {
      console.error('Erreur regles:', err);
    }
  };

  const handleSaveRegles = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSavingRegles(true);
    try {
      await api.put('/horaires/regles-commande', regles);
      setSuccess('Règles de commande enregistrées.');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement des règles');
    } finally {
      setSavingRegles(false);
    }
  };

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

  const resetForm = () => {
    setFormData(defaultForm);
    setHeuresManuelles(genererHeuresLocales(defaultForm.heureDebut, defaultForm.heureFin, defaultForm.intervalleMinutes));
    setNouvelleHeure('12:00');
    setEditingId(null);
  };

  const ouvrirCreation = () => {
    resetForm();
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const ouvrirEdition = (horaire) => {
    const joursSemaine = horaire.joursSemaine?.length
      ? [...horaire.joursSemaine]
      : horaire.date
        ? [new Date(horaire.date).getDay()]
        : [];

    const nextForm = {
      ville: horaire.ville || '',
      adresse: horaire.adresse || '',
      joursSemaine,
      heureDebut: horaire.heureDebut || '10:00',
      heureFin: horaire.heureFin || '18:00',
      intervalleMinutes: horaire.intervalleMinutes || 30,
      disponible: horaire.disponible ?? true,
    };

    setEditingId(horaire._id);
    setFormData(nextForm);
    setHeuresManuelles(trierHeures(horaire.heures || []));
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const fermerForm = () => {
    setShowForm(false);
    resetForm();
  };

  const toggleJour = (jour) => {
    setFormData((prev) => {
      const selected = prev.joursSemaine.includes(jour)
        ? prev.joursSemaine.filter((j) => j !== jour)
        : [...prev.joursSemaine, jour];
      return { ...prev, joursSemaine: selected.sort((a, b) => a - b) };
    });
  };

  const regenererHeures = () => {
    if (formData.heureFin <= formData.heureDebut) {
      setError('L\'heure de fin doit être après l\'heure de début');
      return;
    }
    setHeuresManuelles(genererHeuresLocales(
      formData.heureDebut,
      formData.heureFin,
      formData.intervalleMinutes,
    ));
    setError('');
  };

  const ajouterHeure = () => {
    if (!nouvelleHeure) return;
    setHeuresManuelles((prev) => trierHeures([...prev, nouvelleHeure]));
    setError('');
  };

  const retirerHeure = (heure) => {
    setHeuresManuelles((prev) => prev.filter((h) => h !== heure));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.joursSemaine.length === 0) {
      setError('Sélectionnez au moins un jour de la semaine');
      return;
    }

    if (heuresManuelles.length === 0) {
      setError('Ajoutez au moins un créneau horaire');
      return;
    }

    const payload = {
      ...formData,
      heures: heuresManuelles,
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/horaires/${editingId}`, payload);
        setSuccess('Plage horaire mise à jour avec succès !');
      } else {
        await api.post('/horaires', payload);
        setSuccess('Plage horaire enregistrée avec succès !');
      }
      fermerForm();
      fetchHoraires();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette plage horaire ?')) return;
    try {
      await api.delete(`/horaires/${id}`);
      setSuccess('Horaire supprimé.');
      if (editingId === id) {
        fermerForm();
      }
      fetchHoraires();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const toggleDisponible = async (horaire) => {
    try {
      await api.put(`/horaires/${horaire._id}`, {
        ville: horaire.ville,
        adresse: horaire.adresse,
        joursSemaine: horaire.joursSemaine?.length
          ? horaire.joursSemaine
          : horaire.date
            ? [new Date(horaire.date).getDay()]
            : [3],
        heureDebut: horaire.heureDebut || '10:00',
        heureFin: horaire.heureFin || '18:00',
        intervalleMinutes: horaire.intervalleMinutes || 30,
        heures: horaire.heures || [],
        disponible: !horaire.disponible,
      });
      setSuccess(horaire.disponible ? 'Point de ramassage désactivé.' : 'Point de ramassage activé.');
      fetchHoraires();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  const formatDate = (dateStr) =>
    new Date(`${dateStr}T12:00:00`).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

  const getJourLabel = (value) =>
    JOURS_SEMAINE.find((j) => j.value === value)?.fullLabel || `Jour ${value}`;

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  const hasHoraires = horaires.length > 0;

  return (
    <div className="admin-horaires-page">
      <div className="admin-header">
        <h1>🕐 Horaires de ramassage</h1>
        {hasHoraires && !showForm && (
          <button
            type="button"
            className="btn btn-primary btn-add-plage"
            onClick={ouvrirCreation}
          >
            + Ajouter une plage
          </button>
        )}
      </div>

      <p className="horaires-intro">
        Configurez chaque point de ramassage : choisissez les jours (ex. seulement le mercredi),
        retirez le samedi si besoin, et ajustez les créneaux un par un ou regénérez-les depuis une plage horaire.
      </p>

      <section className="regles-commande-card">
        <h2>⏱️ Règles de délai pour les commandes</h2>
        <p className="regles-commande-intro">
          Contrôlez quand les clients peuvent commander. Ces règles s'appliquent automatiquement sur la page Commander.
        </p>
        <form className="regles-commande-form" onSubmit={handleSaveRegles}>
          <label className="checkbox-label regles-actif">
            <input
              type="checkbox"
              checked={regles.actif}
              onChange={(e) => setRegles({ ...regles, actif: e.target.checked })}
            />
            {' '}Activer les règles de délai
          </label>

          <div className="form-row regles-row">
            <div className="form-group">
              <label htmlFor="heureLimite">Heure limite pour bloquer demain</label>
              <input
                id="heureLimite"
                type="time"
                value={regles.heureLimiteCommande}
                onChange={(e) => setRegles({ ...regles, heureLimiteCommande: e.target.value })}
                className="form-input"
                disabled={!regles.actif}
              />
              <p className="form-help">
                Après cette heure, les clients ne peuvent plus commander pour le <strong>lendemain</strong>.
                Exemple : à 11h01, seules les dates d'après-demain et plus tard sont proposées.
              </p>
            </div>
            <div className="form-group">
              <label htmlFor="delaiMinimum">Délai minimum avant le ramassage</label>
              <div className="delai-input-row">
                <input
                  id="delaiMinimum"
                  type="number"
                  min={0}
                  max={1440}
                  step={15}
                  value={regles.delaiMinimumMinutes}
                  onChange={(e) => setRegles({ ...regles, delaiMinimumMinutes: Number(e.target.value) })}
                  className="form-input delai-input"
                  disabled={!regles.actif}
                />
                <span className="delai-unite">minutes</span>
              </div>
              <p className="form-help">
                Pour le jour même, les créneaux trop proches sont masqués.
                Exemple : à 11h55 avec 60 min de délai → le premier créneau possible est 12h55.
              </p>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={savingRegles}>
            {savingRegles ? 'Enregistrement...' : 'Enregistrer les règles'}
          </button>
        </form>
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <form className="horaire-form" onSubmit={handleSubmit}>
          <div className="horaire-form-header">
            <h2>{editingId ? 'Modifier la plage de ramassage' : 'Nouvelle plage de ramassage'}</h2>
            {hasHoraires && (
              <button type="button" className="btn btn-secondary" onClick={fermerForm}>
                Annuler
              </button>
            )}
          </div>

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
            <p className="form-help">
              Cliquez pour activer ou désactiver un jour. Exemple : seulement mercredi, sans samedi.
            </p>
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
            {formData.joursSemaine.length > 0 && (
              <p className="jours-selectionnes">
                Jours actifs : {formData.joursSemaine.map(getJourLabel).join(', ')}
              </p>
            )}
          </div>

          <div className="form-row form-row-three">
            <div className="form-group">
              <label htmlFor="heureDebut">Heure de début</label>
              <input
                id="heureDebut"
                type="time"
                value={formData.heureDebut}
                onChange={(e) => setFormData({ ...formData, heureDebut: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="heureFin">Heure de fin</label>
              <input
                id="heureFin"
                type="time"
                value={formData.heureFin}
                onChange={(e) => setFormData({ ...formData, heureFin: e.target.value })}
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

          <div className="form-group heures-section">
            <label>Créneaux horaires proposés aux clients *</label>
            <p className="form-help">
              Retirez un créneau avec × ou ajoutez-en un manuellement. Vous pouvez aussi regénérer tous les créneaux depuis la plage ci-dessus.
            </p>

            <div className="heures-badges-editable">
              {heuresManuelles.length === 0 ? (
                <p className="heures-vides">Aucun créneau — ajoutez-en ou regénérez depuis la plage horaire.</p>
              ) : (
                heuresManuelles.map((heure) => (
                  <span key={heure} className="heure-badge-editable">
                    {heure}
                    <button
                      type="button"
                      className="heure-badge-remove"
                      onClick={() => retirerHeure(heure)}
                      aria-label={`Retirer ${heure}`}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            <div className="ajouter-heure-row">
              <input
                type="time"
                value={nouvelleHeure}
                onChange={(e) => setNouvelleHeure(e.target.value)}
                className="form-input heure-ajout-input"
              />
              <button type="button" className="btn btn-secondary" onClick={ajouterHeure}>
                + Ajouter un créneau
              </button>
              <button type="button" className="btn btn-secondary" onClick={regenererHeures}>
                ↻ Regénérer depuis la plage
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.disponible}
                onChange={(e) => setFormData({ ...formData, disponible: e.target.checked })}
              />
              {' '}Disponible pour les commandes
            </label>
          </div>

          <div className="horaire-form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement...' : editingId ? 'Enregistrer les modifications' : 'Enregistrer la plage'}
            </button>
            {hasHoraires && (
              <button type="button" className="btn btn-secondary" onClick={fermerForm}>
                Annuler
              </button>
            )}
          </div>
        </form>
      )}

      <div className="horaires-list">
        {!hasHoraires && !showForm ? (
          <div className="horaires-empty">
            <p>Aucun horaire configuré pour le moment.</p>
            <button
              type="button"
              className="btn btn-primary btn-add-plage"
              onClick={ouvrirCreation}
            >
              + Ajouter ma première plage
            </button>
          </div>
        ) : !hasHoraires ? null : (
          <div className="horaires-grid">
            {horaires.map((horaire) => (
              <div key={horaire._id} className={`horaire-card ${!horaire.disponible ? 'horaire-inactif' : ''}`}>
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
                <div className="horaire-card-actions">
                  <button
                    type="button"
                    onClick={() => ouvrirEdition(horaire)}
                    className="btn btn-primary"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDisponible(horaire)}
                    className="btn btn-secondary"
                  >
                    {horaire.disponible ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(horaire._id)}
                    className="btn btn-danger-inline"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminHoraires;
