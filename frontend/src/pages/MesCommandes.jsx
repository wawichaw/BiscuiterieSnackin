import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { isSlugRepentigny, libelleVilleDepuisSlug, MESSAGE_ADRESSE_PAR_COURRIEL } from '../utils/ramassage';
import './MesCommandes.css';

const MesCommandes = () => {
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="mes-commandes-page">
      <h1>📦 Mes Commandes</h1>
      {commandes.length === 0 ? (
        <p>Aucune commande pour le moment</p>
      ) : (
        <div className="commandes-list">
          {commandes.map((commande) => {
            const dateRamassage = commande.dateRamassage 
              ? new Date(commande.dateRamassage).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : null;
            
            const getStatutLabel = (statut) => {
              const labels = {
                en_attente: 'En attente',
                en_traitement: 'En traitement',
                completee: 'Complétée',
              };
              return labels[statut] || statut;
            };

            return (
              <div key={commande._id} className="commande-card">
                <div className="commande-header">
                  <span>Commande #{commande._id.slice(-6)}</span>
                  <span className={`statut statut-${commande.statut}`}>
                    {getStatutLabel(commande.statut)}
                  </span>
                </div>
                <div className="commande-total">Total: {commande.total.toFixed(2)} $</div>
                <div className="commande-details">
                  <div className="detail-item">
                    <strong>📅 Date de commande:</strong> {new Date(commande.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                  {commande.typeReception === 'ramassage' ? (
                    <>
                      <div className="detail-item">
                        <strong>📍 Point de ramassage:</strong> {libelleVilleDepuisSlug(commande.pointRamassage)}
                      </div>
                      {isSlugRepentigny(commande.pointRamassage) && (
                        <div className="detail-item pickup-info">
                          <strong>📧 Adresse:</strong> {MESSAGE_ADRESSE_PAR_COURRIEL}
                        </div>
                      )}
                      <div className="detail-item pickup-info">
                        <strong>🕐 Ramassage:</strong> {dateRamassage} à {commande.heureRamassage || 'N/A'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="detail-item">
                        <strong>🚚 Livraison:</strong> {commande.villeLivraison?.charAt(0).toUpperCase() + commande.villeLivraison?.slice(1) || 'N/A'}
                      </div>
                      <div className="detail-item">
                        <strong>📍 Adresse:</strong> {commande.adresseLivraison?.rue || 'N/A'}, {commande.adresseLivraison?.codePostal || 'N/A'}
                      </div>
                      <div className="detail-item pickup-info">
                        <strong>🕐 Livraison:</strong> {commande.dateLivraison ? new Date(commande.dateLivraison).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'N/A'} à {commande.heureLivraison || 'N/A'}
                      </div>
                      {commande.fraisLivraison > 0 && (
                        <div className="detail-item">
                          <strong>💰 Frais de livraison:</strong> {commande.fraisLivraison.toFixed(2)} $
                        </div>
                      )}
                    </>
                  )}
                  <div className="detail-item">
                    <strong>💳 Paiement:</strong> {commande.methodePaiement === 'sur_place' ? 'Sur place' : 'En ligne'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MesCommandes;

