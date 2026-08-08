import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { libellePointAvecAdresse } from '../../utils/ramassage';
import '../Commander.css';
import './AdminLienPaiement.css';

const AdminLienPaiement = () => {
  const [biscuits, setBiscuits] = useState([]);
  const [prixBoites, setPrixBoites] = useState({ 4: 15, 6: 20, 12: 35 });
  const [lieuxRamassage, setLieuxRamassage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lienGenere, setLienGenere] = useState('');

  const [visiteurNom, setVisiteurNom] = useState('');
  const [visiteurEmail, setVisiteurEmail] = useState('');
  const [visiteurTelephone, setVisiteurTelephone] = useState('');
  const [pointRamassage, setPointRamassage] = useState('');
  const [dateRamassage, setDateRamassage] = useState('');
  const [heureRamassage, setHeureRamassage] = useState('12:00');
  const [envoyerEmail, setEnvoyerEmail] = useState(true);
  const [boites, setBoites] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [biscuitsRes, tarifsRes, lieuxRes] = await Promise.all([
          api.get('/biscuits?light=1'),
          api.get('/tarifs/boites'),
          api.get('/horaires/lieux'),
        ]);
        setBiscuits(biscuitsRes.data?.data?.biscuits || []);
        const prix = tarifsRes.data?.data?.prixBoites;
        if (prix) setPrixBoites({ 4: prix[4], 6: prix[6], 12: prix[12] });
        setLieuxRamassage(lieuxRes.data?.data?.lieux || []);
      } catch (err) {
        setError('Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const ajouterBoite = () => {
    setBoites((prev) => [...prev, {
      id: Date.now(),
      taille: 4,
      prix: prixBoites[4],
      saveurs: [],
    }]);
  };

  const supprimerBoite = (id) => setBoites((prev) => prev.filter((b) => b.id !== id));

  const changerTailleBoite = (id, taille) => {
    setBoites((prev) => prev.map((b) =>
      b.id === id ? { ...b, taille, prix: prixBoites[taille], saveurs: [] } : b,
    ));
  };

  const getQuantiteTotaleBiscuit = (biscuitId) =>
    boites.reduce((total, boite) => {
      const s = boite.saveurs.find((x) => x.biscuit === biscuitId);
      return total + (s?.quantite || 0);
    }, 0);

  const getStockRestant = (biscuit) =>
    Math.max(0, (biscuit?.stock ?? 0) - getQuantiteTotaleBiscuit(biscuit._id));

  const ajouterSaveur = (boiteId, biscuitId) => {
    const biscuit = biscuits.find((b) => b._id === biscuitId);
    if (biscuit && getStockRestant(biscuit) <= 0) return;

    setBoites((prev) => prev.map((b) => {
      if (b.id !== boiteId) return b;
      const exist = b.saveurs.find((s) => s.biscuit === biscuitId);
      if (exist) {
        return {
          ...b,
          saveurs: b.saveurs.map((s) =>
            s.biscuit === biscuitId ? { ...s, quantite: s.quantite + 1 } : s,
          ),
        };
      }
      return { ...b, saveurs: [...b.saveurs, { biscuit: biscuitId, quantite: 1 }] };
    }));
  };

  const retirerSaveur = (boiteId, biscuitId) => {
    setBoites((prev) => prev.map((b) => {
      if (b.id !== boiteId) return b;
      const exist = b.saveurs.find((s) => s.biscuit === biscuitId);
      if (exist && exist.quantite > 1) {
        return {
          ...b,
          saveurs: b.saveurs.map((s) =>
            s.biscuit === biscuitId ? { ...s, quantite: s.quantite - 1 } : s,
          ),
        };
      }
      return { ...b, saveurs: b.saveurs.filter((s) => s.biscuit !== biscuitId) };
    }));
  };

  const getQuantiteSaveur = (boiteId, biscuitId) => {
    const boite = boites.find((b) => b.id === boiteId);
    return boite?.saveurs.find((s) => s.biscuit === biscuitId)?.quantite || 0;
  };

  const getTotalSaveursBoite = (boite) =>
    boite.saveurs.reduce((t, s) => t + s.quantite, 0);

  const calculerTotal = () => boites.reduce((t, b) => t + b.prix, 0);

  const validerBoites = () => {
    if (boites.length === 0) return 'Ajoutez au moins une boîte';
    for (const boite of boites) {
      if (getTotalSaveursBoite(boite) !== boite.taille) {
        return `La boîte de ${boite.taille} biscuits n'est pas complète`;
      }
    }
    return null;
  };

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(lienGenere);
      setSuccess('Lien copié dans le presse-papiers !');
    } catch {
      setError('Impossible de copier le lien');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLienGenere('');

    const errBoites = validerBoites();
    if (errBoites) {
      setError(errBoites);
      return;
    }
    if (!visiteurNom.trim() || !visiteurEmail.trim()) {
      setError('Nom et courriel du client requis');
      return;
    }
    if (!pointRamassage || !dateRamassage || !heureRamassage) {
      setError('Lieu, date et heure de ramassage requis');
      return;
    }

    const boitesFormatees = boites.map((b) => ({
      taille: b.taille,
      prix: b.prix,
      saveurs: b.saveurs.map((s) => ({ biscuit: s.biscuit, quantite: s.quantite })),
    }));

    const dateComplete = new Date(`${dateRamassage}T${heureRamassage}:00`);

    setSaving(true);
    try {
      const response = await api.post('/commandes/admin/lien-paiement', {
        boites: boitesFormatees,
        typeReception: 'ramassage',
        pointRamassage,
        dateRamassage: dateComplete.toISOString(),
        heureRamassage,
        visiteurNom: visiteurNom.trim(),
        visiteurEmail: visiteurEmail.trim(),
        visiteurTelephone: visiteurTelephone.trim() || undefined,
        total: calculerTotal(),
        envoyerEmail,
      });

      const lien = response.data?.data?.lienPaiement;
      setLienGenere(lien || '');
      setSuccess(
        response.data?.message
        || (envoyerEmail ? 'Lien envoyé au client !' : 'Lien créé — copiez-le pour l\'envoyer'),
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="admin-lien-paiement-page">
      <div className="admin-header">
        <div>
          <Link to="/admin/commandes" className="back-link">← Retour aux commandes</Link>
          <h1>🔗 Lien de paiement client</h1>
        </div>
      </div>

      <p className="lien-paiement-intro">
        Préparez une commande pour un client qui ne veut pas remplir le formulaire.
        Il recevra un lien par courriel (ou copiez-le pour Messenger, SMS, etc.).
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {lienGenere && (
        <div className="lien-genere-box">
          <h3>Lien de paiement</h3>
          <div className="lien-genere-row">
            <input type="text" readOnly value={lienGenere} className="form-input lien-input" />
            <button type="button" className="btn btn-primary" onClick={copierLien}>
              Copier
            </button>
          </div>
          <p className="form-help">Valide 7 jours. Le client paie par carte, Apple Pay ou Google Pay.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="lien-paiement-form">
        <section className="form-section">
          <h2>Informations client</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nom">Nom *</label>
              <input
                id="nom"
                type="text"
                value={visiteurNom}
                onChange={(e) => setVisiteurNom(e.target.value)}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Courriel *</label>
              <input
                id="email"
                type="email"
                value={visiteurEmail}
                onChange={(e) => setVisiteurEmail(e.target.value)}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="tel">Téléphone</label>
              <input
                id="tel"
                type="tel"
                value={visiteurTelephone}
                onChange={(e) => setVisiteurTelephone(e.target.value)}
                className="form-input"
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <h2>Ramassage</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="lieu">Lieu *</label>
              <select
                id="lieu"
                value={pointRamassage}
                onChange={(e) => setPointRamassage(e.target.value)}
                className="form-select"
                required
              >
                <option value="">Choisir un lieu</option>
                {lieuxRamassage.map((lieu) => (
                  <option key={lieu.pointRamassage} value={lieu.pointRamassage}>
                    {libellePointAvecAdresse(lieu)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="date">Date *</label>
              <input
                id="date"
                type="date"
                value={dateRamassage}
                onChange={(e) => setDateRamassage(e.target.value)}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="heure">Heure *</label>
              <input
                id="heure"
                type="time"
                value={heureRamassage}
                onChange={(e) => setHeureRamassage(e.target.value)}
                className="form-input"
                required
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="section-header-row">
            <h2>Boîtes</h2>
            <button type="button" className="btn btn-secondary" onClick={ajouterBoite}>
              + Ajouter une boîte
            </button>
          </div>

          {boites.length === 0 && (
            <p className="form-help">Cliquez sur « Ajouter une boîte » pour commencer.</p>
          )}

          {boites.map((boite) => {
            const totalSaveurs = getTotalSaveursBoite(boite);
            const reste = boite.taille - totalSaveurs;
            return (
              <div key={boite.id} className="boite-card">
                <div className="boite-header">
                  <h3>Boîte de {boite.taille} — {boite.prix.toFixed(2)} $</h3>
                  <button type="button" className="btn-remove" onClick={() => supprimerBoite(boite.id)}>
                    ✕ Supprimer
                  </button>
                </div>
                <div className="boite-taille">
                  <label>Taille :</label>
                  <div className="taille-options">
                    {[4, 6, 12].map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`taille-btn ${boite.taille === t ? 'active' : ''}`}
                        onClick={() => changerTailleBoite(boite.id, t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="boite-saveurs">
                  <label>Saveurs ({reste} restant{reste > 1 ? 's' : ''})</label>
                  <div className="saveurs-grid saveurs-grid-compact">
                    {biscuits.map((biscuit) => {
                      const q = getQuantiteSaveur(boite.id, biscuit._id);
                      const stockRestant = getStockRestant(biscuit);
                      return (
                        <div key={biscuit._id} className="saveur-item">
                          <div className="saveur-info">
                            <strong>{biscuit.nom}</strong>
                          </div>
                          <div className="saveur-controls">
                            {q > 0 && (
                              <button type="button" className="btn-quantity" onClick={() => retirerSaveur(boite.id, biscuit._id)}>-</button>
                            )}
                            {q > 0 && <span className="quantite-badge">{q}</span>}
                            <button
                              type="button"
                              className="btn-quantity"
                              onClick={() => ajouterSaveur(boite.id, biscuit._id)}
                              disabled={reste === 0 || stockRestant === 0}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {reste === 0 && <div className="boite-complete">✓ Boîte complète</div>}
              </div>
            );
          })}

          {boites.length > 0 && (
            <p className="total-preview">Total : <strong>{calculerTotal().toFixed(2)} $</strong></p>
          )}
        </section>

        <label className="checkbox-label envoyer-email-check">
          <input
            type="checkbox"
            checked={envoyerEmail}
            onChange={(e) => setEnvoyerEmail(e.target.checked)}
          />
          {' '}Envoyer le lien par courriel au client
        </label>

        <button type="submit" className="btn btn-primary btn-submit-lien" disabled={saving}>
          {saving ? 'Création...' : envoyerEmail ? 'Créer et envoyer le lien' : 'Créer le lien'}
        </button>
      </form>
    </div>
  );
};

export default AdminLienPaiement;
