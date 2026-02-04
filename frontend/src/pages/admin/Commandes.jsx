import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Commandes.css';

const AdminCommandes = () => {
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchCommandes();
  }, []);

  const fetchCommandes = async () => {
    try {
      const response = await api.get('/commandes');
      setCommandes(response.data.data.commandes);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const changerStatut = async (commandeId, nouveauStatut) => {
    setUpdating(commandeId);
    setMessage('');
    
    try {
      const response = await api.put(`/commandes/${commandeId}`, {
        statut: nouveauStatut,
      });
      
      // Mettre à jour la liste des commandes
      setCommandes(commandes.map(c => 
        c._id === commandeId ? response.data.data.commande : c
      ));
      
      if (nouveauStatut === 'en_traitement') {
        setMessage('✅ Statut mis à jour et email de confirmation envoyé au client !');
      } else {
        setMessage('✅ Statut mis à jour avec succès !');
      }
      
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('Erreur:', error);
      let errorMessage = '❌ Erreur lors de la mise à jour du statut';
      
      if (error.response?.status === 403) {
        errorMessage = '❌ Accès refusé. Vous devez être administrateur pour modifier le statut des commandes.';
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

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="admin-commandes-page">
      <h1>📦 Gérer les commandes</h1>
      
      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="commandes-list">
        {commandes.length === 0 ? (
          <p className="no-commandes">Aucune commande pour le moment.</p>
        ) : (
          commandes.map((commande) => {
            const prochainStatut = getProchainStatut(commande.statut);
            
            // Formater la date de ramassage si elle existe
            const dateRamassage = commande.dateRamassage 
              ? new Date(commande.dateRamassage).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : 'N/A';

            // Déterminer le nom et l'email du client
            const nomClient = commande.user?.name || commande.visiteurNom || 'N/A';
            const emailClient = commande.user?.email || commande.visiteurEmail || 'N/A';

            return (
              <div key={commande._id} className="commande-card">
                <div className="commande-header">
                  <div>
                    <h3>Commande #{commande._id.slice(-6)}</h3>
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
                    <strong>Type de réception:</strong> {commande.typeReception === 'ramassage' ? '📍 Ramassage' : '🚚 Livraison'}
                  </div>
                  {commande.typeReception === 'ramassage' ? (
                    <>
                      <div className="detail-item">
                        <strong>Point de ramassage:</strong> {commande.pointRamassage ? commande.pointRamassage.charAt(0).toUpperCase() + commande.pointRamassage.slice(1) : 'N/A'}
                      </div>
                      <div className="detail-item">
                        <strong>Date et heure:</strong> {dateRamassage} {commande.heureRamassage ? `à ${commande.heureRamassage}` : ''}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="detail-item">
                        <strong>Ville:</strong> {commande.villeLivraison ? commande.villeLivraison.charAt(0).toUpperCase() + commande.villeLivraison.slice(1) : 'N/A'}
                      </div>
                      {commande.adresseLivraison && (
                        <>
                          <div className="detail-item">
                            <strong>Adresse:</strong> {commande.adresseLivraison.rue || 'N/A'}, {commande.adresseLivraison.codePostal || 'N/A'}
                          </div>
                          {commande.adresseLivraison.instructions && (
                            <div className="detail-item">
                              <strong>Instructions:</strong> {commande.adresseLivraison.instructions}
                            </div>
                          )}
                        </>
                      )}
                      <div className="detail-item">
                        <strong>Date et heure:</strong> {commande.dateLivraison ? `${new Date(commande.dateLivraison).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${commande.heureLivraison || '18:00'}` : 'N/A'}
                      </div>
                      {commande.fraisLivraison > 0 && (
                        <div className="detail-item">
                          <strong>Frais de livraison:</strong> {commande.fraisLivraison.toFixed(2)} $
                        </div>
                      )}
                    </>
                  )}
                  <div className="detail-item">
                    <strong>Paiement:</strong> {commande.methodePaiement === 'sur_place' ? 'Sur place' : 'En ligne'}
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

                {prochainStatut && (
                  <div className="commande-actions">
                    <button
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
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminCommandes;

