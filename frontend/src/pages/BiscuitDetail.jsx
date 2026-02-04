import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import './BiscuitDetail.css';

const BiscuitDetail = () => {
  const { id } = useParams();
  const [biscuit, setBiscuit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBiscuit();
  }, [id]);

  const fetchBiscuit = async () => {
    try {
      const response = await api.get(`/biscuits/${id}`);
      setBiscuit(response.data.data.biscuit);
    } catch (error) {
      console.error('Erreur lors du chargement du biscuit:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (!biscuit) {
    return <div className="error">Biscuit non trouvé</div>;
  }

  return (
    <div className="biscuit-detail-page">
      <div className="biscuit-detail">
        <div className="biscuit-detail-image">
          {biscuit.image ? (
            <img src={biscuit.image} alt={biscuit.nom} />
          ) : (
            <div className="biscuit-placeholder">🍪</div>
          )}
        </div>
        <div className="biscuit-detail-info">
          <h1>{biscuit.nom}</h1>
          {biscuit.description && <p className="biscuit-description">{biscuit.description}</p>}
          {biscuit.saveur && (
            <div className="biscuit-saveur">
              <strong>Saveur:</strong> {biscuit.saveur}
            </div>
          )}
          <div className="biscuit-price-large">{biscuit.prix} $</div>
          <div className="biscuit-availability">
            {biscuit.disponible ? (
              <span className="available">✅ Disponible</span>
            ) : (
              <span className="unavailable">❌ Non disponible</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiscuitDetail;

