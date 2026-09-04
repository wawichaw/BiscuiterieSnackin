import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import StripeCheckout from '../components/StripeCheckout';
import './PayerCommande.css';

const PayerCommande = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [commande, setCommande] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paye, setPaye] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError('Lien de paiement invalide');
        setLoading(false);
        return;
      }
      try {
        const response = await api.get(`/commandes/payer/${id}?token=${encodeURIComponent(token)}`);
        setCommande(response.data?.data?.commande);
      } catch (err) {
        setError(err.response?.data?.message || 'Lien invalide ou expiré');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, token]);

  const handlePaiementSuccess = async (paymentIntent) => {
    try {
      await api.post('/paiement/finaliser', { paymentIntentId: paymentIntent.id });
      setPaye(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la confirmation du paiement');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="payer-commande-page">
        <div className="payer-loading">Chargement...</div>
      </div>
    );
  }

  if (error || !commande) {
    return (
      <div className="payer-commande-page">
        <div className="payer-error-box">
          <h1>Lien indisponible</h1>
          <p>{error || 'Ce lien de paiement n\'est plus valide.'}</p>
          <Link to="/commander" className="btn btn-primary">Commander en ligne</Link>
        </div>
      </div>
    );
  }

  if (paye) {
    return (
      <div className="payer-commande-page">
        <div className="payer-success-box">
          <div className="success-icon">✓</div>
          <h1>Paiement confirmé !</h1>
          <p>Merci {commande.visiteurNom} ! Votre commande est bien enregistrée.</p>
          <p className="success-detail">
            Vous recevrez un courriel de confirmation avec votre facture PDF et les détails du ramassage.
          </p>
          <Link to="/" className="btn btn-primary">Retour à l'accueil</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="payer-commande-page">
      <div className="payer-header">
        <h1>🍪 Payer votre commande</h1>
        <p>Bonjour {commande.visiteurNom}, finalisez votre paiement ci-dessous.</p>
      </div>

      <div className="payer-layout">
        <div className="payer-resume">
          <h2>Résumé</h2>
          {commande.boites?.map((boite, i) => (
            <div key={i} className="payer-boite">
              <strong>Boîte {i + 1} — {boite.taille} biscuits ({Number(boite.prix).toFixed(2)} $)</strong>
              <ul>
                {boite.saveurs?.map((s, j) => (
                  <li key={j}>
                    {s.quantite}× {s.biscuit?.nom || 'Biscuit'}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="payer-ramassage">
            <p><strong>Ramassage</strong></p>
            <p>{formatDate(commande.dateRamassage)} à {commande.heureRamassage}</p>
          </div>
          <div className="payer-total">
            Total : <strong>{Number(commande.total).toFixed(2)} $</strong>
          </div>
        </div>

        <div className="payer-stripe">
          <h2>Paiement sécurisé</h2>
          <StripeCheckout
            montant={commande.total}
            commandeId={commande._id}
            onSuccess={handlePaiementSuccess}
            onError={(msg) => setError(msg)}
          />
          {error && <div className="payer-inline-error">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default PayerCommande;
