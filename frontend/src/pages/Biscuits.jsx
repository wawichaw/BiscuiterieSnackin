import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './Biscuits.css';

const Biscuits = () => {
  const [biscuits, setBiscuits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const cached = sessionStorage.getItem('snackin_biscuits');
        if (cached) {
          const { data, at } = JSON.parse(cached);
          if (Date.now() - at < 120000 && Array.isArray(data)) {
            setBiscuits(data);
            setLoading(false);
            setError(null);
            fetchBiscuits(true);
            return;
          }
        }
        await fetchBiscuits(false);
      } catch {
        await fetchBiscuits(false);
      }
    };
    load();
  }, []);

  const fetchBiscuits = async (background = false) => {
    if (!background) {
      setError(null);
      setLoading(true);
    }
    try {
      const response = await api.get('/biscuits');
      const list = response.data?.data?.biscuits;
      const next = Array.isArray(list) ? list : [];
      setBiscuits(next);
      try {
        sessionStorage.setItem('snackin_biscuits', JSON.stringify({ data: next, at: Date.now() }));
      } catch (_) {}
    } catch (err) {
      if (!background) {
        console.error('Erreur chargement biscuits:', err);
        setBiscuits([]);
        setError(err.response?.status === 404 ? 'Aucun biscuit pour le moment.' : 'Impossible de charger le menu. Vérifiez que le serveur est démarré (backend) et que l’adresse API est correcte.');
      }
    } finally {
      if (!background) setLoading(false);
    }
  };

  const getImageUrl = (biscuit) => {
    if (!biscuit?.image) return null;
    const img = biscuit.image;
    if (img.startsWith('data:') || img.startsWith('http://') || img.startsWith('https://')) return img;
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/?$/, '') || window.location.origin;
    return base + (img.startsWith('/') ? '' : '/') + img;
  };

  if (loading && biscuits.length === 0) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="biscuits-page">
      <div className="biscuits-header">
        <h1>🍪 Nos Biscuits</h1>
        <p className="desktop-only">Découvrez notre sélection de biscuits faits maison</p>
        <p className="mobile-only">Biscuits faits maison</p>
      </div>

      {error && (
        <div className="biscuits-error">
          <p>{error}</p>
          <p className="biscuits-error-hint desktop-only">Adresse API utilisée : {import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}</p>
          <button type="button" onClick={fetchBiscuits} className="btn-retry">Réessayer</button>
        </div>
      )}

      <div className="biscuits-grid">
        {biscuits.map((biscuit) => {
          const imageUrl = getImageUrl(biscuit);
          return (
          <Link
            key={biscuit._id}
            to={`/biscuits/${biscuit._id}`}
            className="biscuit-card"
          >
            <div className="biscuit-image">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={biscuit.nom}
                  onError={(e) => { e.target.style.display = 'none'; const next = e.target.nextElementSibling; if (next) next.style.display = 'flex'; }}
                />
              ) : null}
              <div className="biscuit-placeholder" style={{ display: imageUrl ? 'none' : 'flex' }}>🍪</div>
            </div>
            <div className="biscuit-info">
              <h3>{biscuit.nom}</h3>
              {biscuit.description && <p>{biscuit.description}</p>}
              <div className="biscuit-price">{biscuit.prix} $</div>
            </div>
          </Link>
          );
        })}
      </div>

      <div className="biscuits-cta">
        <Link to="/commander" className="btn-commander-now">
          Commander maintenant !
        </Link>
      </div>
    </div>
  );
};

export default Biscuits;

