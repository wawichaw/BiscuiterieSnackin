import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { libellePointAvecAdresse, libelleVilleDepuisSlug } from '../../utils/ramassage';
import { getSourceDecouverteLabel } from '../../utils/sourceDecouverte';
import './Commandes.css';

const getJourKey = (commande) => {
  const dateStr = commande.typeReception === 'ramassage'
    ? commande.dateRamassage
    : commande.dateLivraison;
  if (!dateStr) return 'sans-date';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getLieuKey = (commande) => {
  if (commande.typeReception === 'ramassage') {
    return commande.pointRamassage || 'inconnu';
  }
  return commande.villeLivraison || 'inconnu';
};

const parseLocalDateKey = (key) => {
  if (key === 'sans-date') return null;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatJourLabel = (key) => {
  const d = parseLocalDateKey(key);
  if (!d) return 'Date non définie';
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const isAujourdhui = (key) => {
  const d = parseLocalDateKey(key);
  if (!d) return false;
  const today = new Date();
  return (
    d.getDate() === today.getDate()
    && d.getMonth() === today.getMonth()
    && d.getFullYear() === today.getFullYear()
  );
};

const groupCommandesParJour = (commandes) => {
  const map = new Map();
  for (const commande of commandes) {
    const jour = getJourKey(commande);
    if (!map.has(jour)) map.set(jour, []);
    map.get(jour).push(commande);
  }
  return [...map.entries()].sort(([a], [b]) => {
    if (a === 'sans-date') return 1;
    if (b === 'sans-date') return -1;
    return a.localeCompare(b);
  });
};

const groupCommandesParLieu = (commandes) => {
  const map = new Map();
  for (const commande of commandes) {
    const lieu = getLieuKey(commande);
    if (!map.has(lieu)) map.set(lieu, []);
    map.get(lieu).push(commande);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const heureA = a.heureRamassage || a.heureLivraison || '';
      const heureB = b.heureRamassage || b.heureLivraison || '';
      return heureA.localeCompare(heureB);
    });
  }
  return [...map.entries()].sort(([slugA], [slugB]) => {
    const labelA = libelleVilleDepuisSlug(slugA);
    const labelB = libelleVilleDepuisSlug(slugB);
    return labelA.localeCompare(labelB, 'fr');
  });
};

const compterParStatut = (commandes) => ({
  total: commandes.length,
  enAttente: commandes.filter((c) => c.statut === 'en_attente').length,
  enTraitement: commandes.filter((c) => c.statut === 'en_traitement').length,
  completee: commandes.filter((c) => c.statut === 'completee').length,
});

const CommandeCard = ({
  commande,
  vue,
  updating,
  onChangerStatut,
  onArchiver,
  onRestaurer,
  onRenvoyerLien,
  getStatutLabel,
  getProchainStatut,
}) => {
  const prochainStatut = vue === 'actives' && commande.paiementConfirme !== false
    ? getProchainStatut(commande.statut)
    : null;
  const enAttentePaiement = commande.creeParAdmin && !commande.paiementConfirme;

  const dateRamassage = commande.dateRamassage
    ? new Date(commande.dateRamassage).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : 'N/A';

  const nomClient = commande.user?.name || commande.visiteurNom || 'N/A';
  const emailClient = commande.user?.email || commande.visiteurEmail || 'N/A';
  const dateCommande = commande.createdAt
    ? new Date(commande.createdAt).toLocaleString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'N/A';

  return (
    <div className={`commande-card ${commande.archivee ? 'commande-archivee' : ''}`}>
      <div className="commande-header">
        <div>
          <h3>Commande #{commande._id.slice(-6)}</h3>
          <p className="commande-date">
            <strong>Passée le :</strong> {dateCommande}
          </p>
          {commande.archiveeLe && (
            <p className="commande-date-archive">
              <strong>Archivée le :</strong>{' '}
              {new Date(commande.archiveeLe).toLocaleString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
          <p className="commande-client">
            <strong>Client:</strong> {nomClient} ({emailClient})
          </p>
        </div>
        <span className={`statut statut-${commande.statut}`}>
          {getStatutLabel(commande.statut)}
        </span>
      </div>

      <div className="commande-details">
        <div className="detail-item">
          <strong>Total:</strong> {commande.total?.toFixed(2) || '0.00'} $
        </div>
        <div className={`detail-item detail-item-source ${commande.sourceDecouverte && !commande.creeParAdmin ? '' : 'source-manquante'}`}>
          <strong>{commande.creeParAdmin ? 'Origine de la commande' : 'Comment nous avez-vous trouvé ?'}</strong>
          {getSourceDecouverteLabel(commande)}
        </div>
        <div className="detail-item">
          <strong>Type de réception:</strong>{' '}
          {commande.typeReception === 'ramassage' ? '📍 Ramassage' : '🚚 Livraison'}
        </div>
        {commande.typeReception === 'ramassage' ? (
          <>
            <div className="detail-item">
              <strong>Point de ramassage:</strong>{' '}
              {commande.pointRamassage
                ? commande.pointRamassage.charAt(0).toUpperCase() + commande.pointRamassage.slice(1)
                : 'N/A'}
            </div>
            <div className="detail-item">
              <strong>Date et heure:</strong> {dateRamassage}{' '}
              {commande.heureRamassage ? `à ${commande.heureRamassage}` : ''}
            </div>
          </>
        ) : (
          <>
            <div className="detail-item">
              <strong>Ville:</strong>{' '}
              {commande.villeLivraison
                ? commande.villeLivraison.charAt(0).toUpperCase() + commande.villeLivraison.slice(1)
                : 'N/A'}
            </div>
            {commande.adresseLivraison && (
              <>
                <div className="detail-item">
                  <strong>Adresse:</strong> {commande.adresseLivraison.rue || 'N/A'},{' '}
                  {commande.adresseLivraison.codePostal || 'N/A'}
                </div>
                {commande.adresseLivraison.instructions && (
                  <div className="detail-item">
                    <strong>Instructions:</strong> {commande.adresseLivraison.instructions}
                  </div>
                )}
              </>
            )}
            <div className="detail-item">
              <strong>Date et heure:</strong>{' '}
              {commande.dateLivraison
                ? `${new Date(commande.dateLivraison).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })} à ${commande.heureLivraison || '18:00'}`
                : 'N/A'}
            </div>
            {commande.fraisLivraison > 0 && (
              <div className="detail-item">
                <strong>Frais de livraison:</strong> {commande.fraisLivraison.toFixed(2)} $
              </div>
            )}
          </>
        )}
        <div className="detail-item">
          <strong>Paiement:</strong>{' '}
          {commande.methodePaiement === 'sur_place' ? 'Sur place' : 'En ligne'}
          {commande.paiementConfirme ? (
            <span style={{ color: '#28a745', marginLeft: '8px' }}>✓ Confirmé</span>
          ) : enAttentePaiement ? (
            <span className="badge-paiement-attente">⏳ En attente de paiement</span>
          ) : null}
        </div>
      </div>

      <div className="commande-boites">
        <strong>Boîtes commandées:</strong>
        {commande.boites && commande.boites.length > 0 ? (
          commande.boites.map((boite, index) => (
            <div key={index} className="boite-detail">
              Boîte {index + 1}: {boite.taille} biscuits ({boite.prix?.toFixed(2) || '0.00'} $)
              {boite.saveurs && boite.saveurs.length > 0 && (
                <ul>
                  {boite.saveurs.map((saveur, sIndex) => (
                    <li key={sIndex}>
                      {saveur.quantite}x {saveur.biscuit?.nom || 'Biscuit'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        ) : (
          <p>Aucune boîte</p>
        )}
      </div>

      <div className="commande-actions">
        {enAttentePaiement && commande.tokenPaiement && (
          <>
            <button
              type="button"
              className="btn-statut btn-lien-paiement"
              onClick={() => {
                const lien = `${window.location.origin}/payer/${commande._id}?token=${encodeURIComponent(commande.tokenPaiement)}`;
                navigator.clipboard.writeText(lien);
              }}
            >
              📋 Copier le lien de paiement
            </button>
            <button
              type="button"
              className="btn-statut btn-renvoyer-lien"
              onClick={() => onRenvoyerLien(commande._id)}
              disabled={updating === commande._id}
            >
              {updating === commande._id ? 'Envoi...' : '📧 Renvoyer le courriel'}
            </button>
          </>
        )}

        {prochainStatut && (
          <button
            type="button"
            onClick={() => onChangerStatut(commande._id, prochainStatut)}
            disabled={updating === commande._id}
            className={`btn-statut btn-${prochainStatut}`}
          >
            {updating === commande._id ? 'Mise à jour...' : (
              prochainStatut === 'en_traitement'
                ? '✓ Marquer en traitement (envoie email)'
                : '✓ Marquer comme complétée'
            )}
          </button>
        )}

        {vue === 'actives' && commande.statut === 'completee' && (
          <button
            type="button"
            onClick={() => onArchiver(commande._id)}
            disabled={updating === commande._id}
            className="btn-statut btn-archiver"
          >
            {updating === commande._id ? 'Archivage...' : '📁 Archiver'}
          </button>
        )}

        {vue === 'archivees' && (
          <button
            type="button"
            onClick={() => onRestaurer(commande._id)}
            disabled={updating === commande._id}
            className="btn-statut btn-restaurer"
          >
            {updating === commande._id ? 'Restauration...' : '↩ Restaurer au suivi actif'}
          </button>
        )}
      </div>
    </div>
  );
};

const AdminCommandes = () => {
  const [commandes, setCommandes] = useState([]);
  const [lieuxRamassage, setLieuxRamassage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [message, setMessage] = useState('');
  const [vue, setVue] = useState('actives');
  const [jourSelectionne, setJourSelectionne] = useState(null);

  useEffect(() => {
    fetchCommandes(vue);
  }, [vue]);

  useEffect(() => {
    const loadLieux = async () => {
      try {
        const response = await api.get('/horaires/lieux');
        setLieuxRamassage(response.data?.data?.lieux || []);
      } catch (err) {
        console.error('Erreur chargement lieux:', err);
      }
    };
    loadLieux();
  }, []);

  useEffect(() => {
    setJourSelectionne(null);
  }, [vue]);

  const fetchCommandes = async (mode = vue) => {
    setLoading(true);
    try {
      const archivees = mode === 'archivees' ? 'true' : 'false';
      const response = await api.get(`/commandes?archivees=${archivees}`);
      const list = response.data.data.commandes || [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setCommandes(list);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const mettreAJourCommande = async (commandeId, payload, successMsg) => {
    setUpdating(commandeId);
    setMessage('');

    try {
      const response = await api.put(`/commandes/${commandeId}`, payload);
      const updated = response.data.data.commande;

      if (payload.archivee !== undefined) {
        setCommandes((prev) => prev.filter((c) => c._id !== commandeId));
      } else {
        setCommandes((prev) => prev.map((c) => (c._id === commandeId ? updated : c)));
      }

      setMessage(successMsg);
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('Erreur:', error);
      let errorMessage = '❌ Erreur lors de la mise à jour';

      if (error.response?.status === 403) {
        errorMessage = '❌ Accès refusé. Vous devez être administrateur.';
      } else if (error.response?.status === 401) {
        errorMessage = '❌ Session expirée. Veuillez vous reconnecter.';
      } else if (error.response?.data?.message) {
        errorMessage = `❌ ${error.response.data.message}`;
      }

      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setUpdating(null);
    }
  };

  const changerStatut = (commandeId, nouveauStatut) => {
    const msg = nouveauStatut === 'en_traitement'
      ? '✅ Statut mis à jour et email de confirmation envoyé au client !'
      : '✅ Statut mis à jour avec succès !';
    mettreAJourCommande(commandeId, { statut: nouveauStatut }, msg);
  };

  const archiverCommande = (commandeId) => {
    if (!window.confirm('Archiver cette commande complétée ?')) return;
    mettreAJourCommande(commandeId, { archivee: true }, '✅ Commande archivée.');
  };

  const restaurerCommande = (commandeId) => {
    mettreAJourCommande(commandeId, { archivee: false }, '✅ Commande restaurée dans le suivi actif.');
  };

  const renvoyerLienPaiement = async (commandeId) => {
    setUpdating(commandeId);
    setMessage('');
    try {
      await api.post(`/commandes/admin/lien-paiement/${commandeId}/renvoyer`);
      setMessage('✅ Courriel renvoyé au client.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Erreur lors de l\'envoi');
    } finally {
      setUpdating(null);
    }
  };

  const getStatutLabel = (statut) => {
    const labels = {
      en_attente: 'En attente',
      en_traitement: 'En traitement',
      completee: 'Complétée',
    };
    return labels[statut] || statut;
  };

  const getProchainStatut = (statutActuel) => {
    if (statutActuel === 'en_attente') return 'en_traitement';
    if (statutActuel === 'en_traitement') return 'completee';
    return null;
  };

  const getLieuLabel = (slug) => {
    const lieu = lieuxRamassage.find((l) => l.pointRamassage === slug);
    if (lieu) return libellePointAvecAdresse(lieu, slug);
    return libelleVilleDepuisSlug(slug);
  };

  const commandesParJour = useMemo(
    () => groupCommandesParJour(commandes),
    [commandes],
  );

  const commandesJourSelectionne = useMemo(() => {
    if (!jourSelectionne) return [];
    const entry = commandesParJour.find(([jour]) => jour === jourSelectionne);
    return entry ? entry[1] : [];
  }, [commandesParJour, jourSelectionne]);

  const commandesParLieu = useMemo(
    () => groupCommandesParLieu(commandesJourSelectionne),
    [commandesJourSelectionne],
  );

  const cardProps = {
    vue,
    updating,
    onChangerStatut: changerStatut,
    onArchiver: archiverCommande,
    onRestaurer: restaurerCommande,
    onRenvoyerLien: renvoyerLienPaiement,
    getStatutLabel,
    getProchainStatut,
  };

  return (
    <div className="admin-commandes-page">
      <div className="commandes-page-header">
        <div>
          <h1>📦 Gérer les commandes</h1>
          <p className="commandes-page-subtitle">
            {vue === 'actives'
              ? 'Commandes regroupées par jour de ramassage, puis par lieu.'
              : 'Historique des commandes complétées et archivées, par jour et par lieu.'}
          </p>
        </div>
        <div className="commandes-header-actions">
          <Link to="/admin/statistiques" className="btn outline btn-stats-header">
            📊 Statistiques
          </Link>
          <Link to="/admin/lien-paiement" className="btn primary btn-lien-paiement-header">
            🔗 Créer un lien de paiement
          </Link>
        </div>
      </div>

      <div className="commandes-tabs" role="tablist" aria-label="Filtrer les commandes">
        <button
          type="button"
          role="tab"
          aria-selected={vue === 'actives'}
          className={`commandes-tab ${vue === 'actives' ? 'active' : ''}`}
          onClick={() => setVue('actives')}
        >
          📋 Suivi actif
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vue === 'archivees'}
          className={`commandes-tab ${vue === 'archivees' ? 'active' : ''}`}
          onClick={() => setVue('archivees')}
        >
          📁 Archivées
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <p className="no-commandes">Chargement...</p>
      ) : commandes.length === 0 ? (
        <p className="no-commandes">
          {vue === 'archivees'
            ? 'Aucune commande archivée.'
            : 'Aucune commande active pour le moment.'}
        </p>
      ) : !jourSelectionne ? (
        <div className="jours-grid">
          {commandesParJour.map(([jourKey, commandesJour]) => {
            const stats = compterParStatut(commandesJour);
            const lieux = groupCommandesParLieu(commandesJour);

            return (
              <button
                key={jourKey}
                type="button"
                className={`jour-card ${isAujourdhui(jourKey) ? 'jour-aujourdhui' : ''}`}
                onClick={() => setJourSelectionne(jourKey)}
              >
                <div className="jour-card-header">
                  <h2>{formatJourLabel(jourKey)}</h2>
                  {isAujourdhui(jourKey) && <span className="jour-badge-aujourdhui">Aujourd&apos;hui</span>}
                </div>
                <p className="jour-card-count">
                  {stats.total} commande{stats.total > 1 ? 's' : ''}
                </p>
                <div className="jour-card-stats">
                  {stats.enAttente > 0 && (
                    <span className="jour-stat jour-stat-attente">{stats.enAttente} en attente</span>
                  )}
                  {stats.enTraitement > 0 && (
                    <span className="jour-stat jour-stat-traitement">{stats.enTraitement} en traitement</span>
                  )}
                  {stats.completee > 0 && (
                    <span className="jour-stat jour-stat-completee">{stats.completee} complétée{stats.completee > 1 ? 's' : ''}</span>
                  )}
                </div>
                <ul className="jour-card-lieux">
                  {lieux.map(([slug, list]) => (
                    <li key={slug}>
                      📍 {getLieuLabel(slug)} — {list.length} commande{list.length > 1 ? 's' : ''}
                    </li>
                  ))}
                </ul>
                <span className="jour-card-action">Voir les commandes →</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="jour-detail">
          <button
            type="button"
            className="btn-retour-jours"
            onClick={() => setJourSelectionne(null)}
          >
            ← Retour aux journées
          </button>

          <div className="jour-detail-header">
            <h2>{formatJourLabel(jourSelectionne)}</h2>
            {isAujourdhui(jourSelectionne) && (
              <span className="jour-badge-aujourdhui">Aujourd&apos;hui</span>
            )}
            <p className="jour-detail-count">
              {commandesJourSelectionne.length} commande{commandesJourSelectionne.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="lieux-sections">
            {commandesParLieu.map(([slug, commandesLieu]) => (
              <section key={slug} className="lieu-section">
                <div className="lieu-section-header">
                  <h3>📍 {getLieuLabel(slug)}</h3>
                  <span className="lieu-section-count">
                    {commandesLieu.length} commande{commandesLieu.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="commandes-list">
                  {commandesLieu.map((commande) => (
                    <CommandeCard
                      key={commande._id}
                      commande={commande}
                      {...cardProps}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCommandes;
