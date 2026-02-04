import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './Biscuits.css';

const Biscuits = () => {
  const [biscuits, setBiscuits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBiscuits();
  }, []);

  const fetchBiscuits = async () => {
    try {
      const response = await api.get('/biscuits');
      setBiscuits(response.data.data.biscuits);
    } catch (error) {
      console.error('Erreur lors du chargement des biscuits:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="biscuits-page">
      <div className="biscuits-header">
        <h1>🍪 Nos Biscuits</h1>
        <p>Découvrez notre sélection de biscuits faits maison</p>
      </div>

      <div className="biscuits-grid">
        {biscuits.map((biscuit) => (
          <Link
            key={biscuit._id}
            to={`/biscuits/${biscuit._id}`}
            className="biscuit-card"
          >
            <div className="biscuit-image">
              {biscuit.image ? (
                <img src={biscuit.image} alt={biscuit.nom} />
              ) : (
                <div className="biscuit-placeholder">🍪</div>
              )}
            </div>
            <div className="biscuit-info">
              <h3>{biscuit.nom}</h3>
              {biscuit.description && <p>{biscuit.description}</p>}
              <div className="biscuit-price">{biscuit.prix} $</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Biscuits;

