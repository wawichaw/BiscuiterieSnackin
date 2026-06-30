import React, { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
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
  const [expressMethods, setExpressMethods] = useState(null);

  const resolvePaymentIntent = useCallback(async () => {
    if (!stripe || !clientSecret) return null;
    try {
      const retrieved = await stripe.retrievePaymentIntent(clientSecret);
      return retrieved?.paymentIntent ?? null;
    } catch (err) {
      console.error('Erreur lors de la récupération du PaymentIntent:', err);
      return null;
    }
  }, [stripe, clientSecret]);

  const finalizePayment = useCallback(async (paymentIntent) => {
    let intent = paymentIntent;
    if (!intent || intent.status !== 'succeeded') {
      intent = await resolvePaymentIntent();
    }
    if (intent?.status === 'succeeded') {
      setPaymentCompleted(true);
      onSuccess(intent);
      return true;
    }
    if (intent) {
      const msg = `Le paiement n'a pas été complété. Statut: ${intent.status}`;
      onError(msg);
      return false;
    }
    onError('Le paiement n\'a pas été complété. Veuillez réessayer.');
    return false;
  }, [onSuccess, onError, resolvePaymentIntent]);

  const handleStripeError = useCallback(async (stripeError) => {
    console.error('Erreur Stripe:', stripeError);
    let errorMessage = stripeError.message;

    if (stripeError.code === 'payment_intent_unexpected_state') {
      try {
        const retrieved = await resolvePaymentIntent();
        if (retrieved?.status === 'succeeded') {
          setPaymentCompleted(true);
          onSuccess(retrieved);
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
    onError(errorMessage);
  }, [resolvePaymentIntent, onSuccess, onError]);

  const confirmStripePayment = useCallback(async () => {
    if (!stripe || !elements) {
      const msg = 'Stripe n\'est pas encore chargé. Veuillez patienter...';
      setError(msg);
      onError(msg);
      return false;
    }

    if (!clientSecret) {
      const msg = 'Le paiement n\'est pas encore initialisé. Veuillez patienter...';
      setError(msg);
      onError(msg);
      return false;
    }

    try {
      const currentPaymentIntent = await resolvePaymentIntent();
      if (currentPaymentIntent?.status === 'succeeded') {
        setPaymentCompleted(true);
        onSuccess(currentPaymentIntent);
        return true;
      }
    } catch (retrieveError) {
      console.error('Erreur lors de la récupération du PaymentIntent:', retrieveError);
    }

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}`,
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      await handleStripeError(stripeError);
      return false;
    }

    return finalizePayment(paymentIntent);
  }, [stripe, elements, onSuccess, handleStripeError, finalizePayment, onError, resolvePaymentIntent]);

  const handleExpressConfirm = async () => {
    if (processing || paymentCompleted) return;

    setProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        console.warn('Express checkout submit:', submitError.message);
      }

      await confirmStripePayment();
    } catch (err) {
      console.error('Erreur paiement express (Link / Apple Pay / Google Pay):', err);
      const msg = 'Une erreur inattendue s\'est produite. Veuillez réessayer.';
      setError(msg);
      onError(msg);
    }

    setProcessing(false);
  };

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
      await confirmStripePayment();
    } catch (err) {
      console.error('Erreur lors du traitement du paiement:', err);
      setError('Une erreur inattendue s\'est produite. Veuillez réessayer.');
      onError('Une erreur inattendue s\'est produite. Veuillez réessayer.');
    }

    setProcessing(false);
  };

  const hasExpressCheckout = Boolean(
    expressMethods?.applePay || expressMethods?.googlePay || expressMethods?.link
  );

  return (
    <form onSubmit={handleSubmit} className="stripe-checkout-form">
      <div className="stripe-express-checkout">
        <ExpressCheckoutElement
          options={{
            buttonTheme: { applePay: 'black' },
            buttonType: { applePay: 'buy' },
            buttonHeight: 48,
            layout: { maxColumns: 1, maxRows: 3 },
            paymentMethods: {
              applePay: 'always',
              googlePay: 'auto',
              link: 'auto',
            },
          }}
          onReady={({ availablePaymentMethods }) => {
            setExpressMethods(availablePaymentMethods ?? null);
          }}
          onConfirm={handleExpressConfirm}
        />
      </div>

      {hasExpressCheckout && (
        <div className="stripe-checkout-divider">
          <span>ou payer par carte</span>
        </div>
      )}

      <div className="stripe-payment-element">
        <PaymentElement
          options={{
            layout: 'accordion',
            wallets: {
              applePay: 'never',
              googlePay: 'never',
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
