import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Commandes.css';

const AdminCommandes = () => {
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [message, setMessage] = useState('');
  const [vue, setVue] = useState('actives'); // 'actives' | 'archivees'

  useEffect(() => {
    fetchCommandes(vue);
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

  return (
    <div className="admin-commandes-page">
      <div className="commandes-page-header">
        <div>
          <h1>📦 Gérer les commandes</h1>
          <p className="commandes-page-subtitle">
            {vue === 'actives'
              ? 'Commandes en cours — archivez les commandes complétées pour alléger la liste.'
              : 'Historique des commandes complétées et archivées.'}
          </p>
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

      <div className="commandes-list">
        {loading ? (
          <p className="no-commandes">Chargement...</p>
        ) : commandes.length === 0 ? (
          <p className="no-commandes">
            {vue === 'archivees'
              ? 'Aucune commande archivée.'
              : 'Aucune commande active pour le moment.'}
          </p>
        ) : (
          commandes.map((commande) => {
            const prochainStatut = vue === 'actives' ? getProchainStatut(commande.statut) : null;

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
              <div
                key={commande._id}
                className={`commande-card ${commande.archivee ? 'commande-archivee' : ''}`}
              >
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
                    {commande.paiementConfirme && (
                      <span style={{ color: '#28a745', marginLeft: '8px' }}>✓ Confirmé</span>
                    )}
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
                  {prochainStatut && (
                    <button
                      type="button"
                      onClick={() => changerStatut(commande._id, prochainStatut)}
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
                      onClick={() => archiverCommande(commande._id)}
                      disabled={updating === commande._id}
                      className="btn-statut btn-archiver"
                    >
                      {updating === commande._id ? 'Archivage...' : '📁 Archiver'}
                    </button>
                  )}

                  {vue === 'archivees' && (
                    <button
                      type="button"
                      onClick={() => restaurerCommande(commande._id)}
                      disabled={updating === commande._id}
                      className="btn-statut btn-restaurer"
                    >
                      {updating === commande._id ? 'Restauration...' : '↩ Restaurer au suivi actif'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminCommandes;
