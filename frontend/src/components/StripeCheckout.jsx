import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import api from '../services/api';
import './StripeCheckout.css';

// Initialiser Stripe avec la clé publique
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_51SliJ2F6Pjll7pFtcqPtp0DctdyBA3lFiDz7ZlxM1ViS3exlpqC8o0MnH3m4ntP4eKFDUy19NYc2WUMMhW61ItFZ002X1rDjYP');

const CheckoutForm = ({ montant, commandeId, onSuccess, onError, clientSecret }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('Stripe n\'est pas encore chargé. Veuillez patienter...');
      return;
    }

    if (!clientSecret) {
      setError('Le paiement n\'est pas encore initialisé. Veuillez patienter...');
      return;
    }

    // Empêcher les soumissions multiples ou si le paiement est déjà complété
    if (processing || paymentCompleted) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Vérifier d'abord le statut actuel du PaymentIntent
      let currentPaymentIntent;
      
      try {
        currentPaymentIntent = await stripe.retrievePaymentIntent(clientSecret);
        
        // Si le PaymentIntent est déjà succeeded, ne pas essayer de le confirmer à nouveau
        if (currentPaymentIntent?.paymentIntent?.status === 'succeeded') {
          console.log('PaymentIntent déjà confirmé avec succès');
          setPaymentCompleted(true);
          onSuccess(currentPaymentIntent.paymentIntent);
          setProcessing(false);
          return;
        }
      } catch (retrieveError) {
        console.error('Erreur lors de la récupération du PaymentIntent:', retrieveError);
        // Continuer avec la confirmation normale si la récupération échoue
      }

      // Utiliser confirmPayment avec PaymentElement (plus moderne et gère mieux les codes postaux)
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href, // Pas utilisé mais requis
        },
        redirect: 'if_required', // Ne pas rediriger automatiquement
      });

      if (stripeError) {
        console.error('Erreur Stripe:', stripeError);
        let errorMessage = stripeError.message;
        
        // Gérer l'erreur spécifique "payment_intent_unexpected_state"
        if (stripeError.code === 'payment_intent_unexpected_state') {
          // Le PaymentIntent est peut-être déjà confirmé, vérifier à nouveau
          try {
            const retrieved = await stripe.retrievePaymentIntent(clientSecret);
            if (retrieved.paymentIntent.status === 'succeeded') {
              setPaymentCompleted(true);
              onSuccess(retrieved.paymentIntent);
              setProcessing(false);
              return;
            }
          } catch (err) {
            console.error('Erreur lors de la vérification:', err);
          }
          errorMessage = 'Le paiement a déjà été traité. Si votre commande n\'apparaît pas, veuillez rafraîchir la page.';
        } else if (stripeError.code === 'card_declined') {
          errorMessage = 'Votre carte a été refusée. Veuillez vérifier les informations ou utiliser une autre carte.';
        } else if (stripeError.code === 'incorrect_cvc') {
          errorMessage = 'Le code de sécurité (CVC) est incorrect.';
        } else if (stripeError.code === 'incorrect_number') {
          errorMessage = 'Le numéro de carte est incorrect.';
        } else if (stripeError.code === 'invalid_expiry_month' || stripeError.code === 'invalid_expiry_year') {
          errorMessage = 'La date d\'expiration est invalide.';
        } else if (stripeError.code === 'invalid_postal_code') {
          errorMessage = 'Le code postal est invalide. Pour le Canada, utilisez le format H1A 1A1 (lettres et chiffres).';
        }
        
        setError(errorMessage);
        setProcessing(false);
        onError(errorMessage);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Le paiement est réussi, marquer comme complété et appeler onSuccess
        setPaymentCompleted(true);
        onSuccess(paymentIntent);
      } else if (paymentIntent) {
        onError(`Le paiement n'a pas été complété. Statut: ${paymentIntent.status}`);
        setProcessing(false);
      } else {
        // Pas de paymentIntent retourné, mais pas d'erreur non plus
        onError('Le paiement n\'a pas été complété. Veuillez réessayer.');
        setProcessing(false);
      }
    } catch (err) {
      console.error('Erreur lors du traitement du paiement:', err);
      setError('Une erreur inattendue s\'est produite. Veuillez réessayer.');
      onError('Une erreur inattendue s\'est produite. Veuillez réessayer.');
    }

    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="stripe-checkout-form">
      <div className="stripe-payment-element">
        <PaymentElement
          options={{
            layout: 'tabs',
            wallets: {
              applePay: 'auto',
              googlePay: 'auto',
            },
            fields: {
              billingDetails: {
                address: {
                  country: 'auto',
                  postalCode: 'auto',
                },
              },
            },
          }}
        />
      </div>
      <div className="stripe-postal-code-note">
        <small>💡 Code postal canadien : Format H1A 1A1 (lettres et chiffres). Exemple : H1A 1A1, J4K 2M3</small>
      </div>
      {error && <div className="stripe-error">{error}</div>}
      <button
        type="submit"
        disabled={!stripe || !clientSecret || processing || paymentCompleted}
        className="stripe-submit-btn"
      >
        {processing ? 'Traitement...' : paymentCompleted ? 'Paiement complété ✓' : `Payer ${montant.toFixed(2)} $ CAD`}
      </button>
      <div className="stripe-security-note">
        🔒 Paiement sécurisé par Stripe — carte, Apple Pay ou Google Pay
      </div>
    </form>
  );
};

const StripeCheckout = ({ montant, commandeId, onSuccess, onError }) => {
  const [clientSecret, setClientSecret] = useState('');

  // Créer le PaymentIntent au chargement du composant
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await api.post('/paiement/create-intent', {
          montant,
          commandeId,
        });
        if (response.data.success) {
          setClientSecret(response.data.clientSecret);
        } else {
          onError(response.data.message || 'Erreur lors de l\'initialisation du paiement');
        }
      } catch (err) {
        console.error('Erreur création PaymentIntent:', err);
        onError(err.response?.data?.message || 'Erreur lors de l\'initialisation du paiement');
      }
    };

    if (montant > 0 && !clientSecret) {
      createPaymentIntent();
    }
  }, [montant, commandeId]);

  if (!clientSecret) {
    return (
      <div className="stripe-loading">
        <p>Initialisation du paiement...</p>
      </div>
    );
  }

  return (
    <Elements 
      stripe={stripePromise}
      options={{
        clientSecret,
        locale: 'fr',
        appearance: {
          theme: 'stripe',
        },
      }}
    >
      <CheckoutForm
        montant={montant}
        commandeId={commandeId}
        onSuccess={onSuccess}
        onError={onError}
        clientSecret={clientSecret}
      />
    </Elements>
  );
};

export default StripeCheckout;
