import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import {
  isAdresseParCourriel,
  libellePointAvecAdresse,
  MESSAGE_ADRESSE_PAR_COURRIEL,
} from '../utils/ramassage';
import { useAuth } from '../contexts/AuthContext';
import StripeCheckout from '../components/StripeCheckout';
import './Commander.css';

const CACHE_TTL_MS = 5 * 60 * 1000;

const TYPE_RECEPTION = 'ramassage';
const METHODE_PAIEMENT = 'en_ligne';
const PENDING_COMMANDE_KEY = 'snackin_pending_commande';

const Commander = () => {
  const { user } = useAuth();
  const [biscuits, setBiscuits] = useState([]);
  const [boites, setBoites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1); // 1: boîtes, 2: ramassage, 3: paiement/infos, 4: confirmation
  const [pointRamassage, setPointRamassage] = useState('');
  const [lieuxRamassage, setLieuxRamassage] = useState([]);
  const [dateRamassage, setDateRamassage] = useState('');
  const [heureRamassage, setHeureRamassage] = useState('');
  const [heuresDisponibles, setHeuresDisponibles] = useState([]);
  const [datesDisponibles, setDatesDisponibles] = useState([]);
  const [error, setError] = useState('');
  // Informations visiteur
  const [visiteurNom, setVisiteurNom] = useState('');
  const [visiteurEmail, setVisiteurEmail] = useState('');
  const [visiteurTelephone, setVisiteurTelephone] = useState('');
  const [commandeCreee, setCommandeCreee] = useState(null);
  const [commandeEnAttenteId, setCommandeEnAttenteId] = useState(null);
  const [preparationPaiement, setPreparationPaiement] = useState(false);
  const [paiementEnCours, setPaiementEnCours] = useState(false);
  const [prixBoites, setPrixBoites] = useState({ 4: 15, 6: 20, 12: 35 });
  const navigate = useNavigate();

  const mergeImages = (newList, oldList = []) => {
    const oldById = new Map(oldList.map((b) => [b._id, b]));
    return newList.map((b) => {
      if (b.image) return b;
      const old = oldById.get(b._id);
      return old?.image ? { ...b, image: old.image } : b;
    });
  };
  const hasAnyImage = (list = []) => list.some((b) => Boolean(b?.image));

  useEffect(() => {
    let cancelled = false;

    // Afficher instantanément depuis le cache persistant si disponible.
    try {
      const cachedBiscuits = localStorage.getItem('snackin_biscuits');
      if (cachedBiscuits) {
        const { data, at } = JSON.parse(cachedBiscuits);
        if (Date.now() - at < CACHE_TTL_MS && Array.isArray(data)) {
          setBiscuits(data.filter(b => b.disponible !== false));
          setLoading(false);
        }
      }
      const cachedTarifs = localStorage.getItem('snackin_tarifs_boites');
      if (cachedTarifs) {
        const { data, at } = JSON.parse(cachedTarifs);
        if (Date.now() - at < CACHE_TTL_MS && data) {
          const p4 = Number(data[4]);
          const p6 = Number(data[6]);
          const p12 = Number(data[12]);
          if (!Number.isNaN(p4) && !Number.isNaN(p6) && !Number.isNaN(p12)) {
            setPrixBoites({ 4: p4, 6: p6, 12: p12 });
          }
        }
      }
    } catch (_) {}

    const loadInitialData = async () => {
      try {
        const [biscuitsRes, tarifsRes] = await Promise.all([
          api.get('/biscuits?light=1'),
          api.get('/tarifs/boites'),
        ]);
        if (cancelled) return;
        const list = biscuitsRes.data?.data?.biscuits || [];
        const cachedList = (() => {
          try {
            const raw = localStorage.getItem('snackin_biscuits');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed?.data) ? parsed.data : [];
          } catch (_) {
            return [];
          }
        })();
        const merged = mergeImages(list, cachedList).filter(b => b.disponible !== false);
        setBiscuits(merged);
        try {
          localStorage.setItem('snackin_biscuits', JSON.stringify({ data: merged, at: Date.now() }));
        } catch (_) {}

        // Fallback : si on n'a aucune image (cache vide ou ancien), charger la version complète en arrière-plan.
        if (!hasAnyImage(merged)) {
          api.get('/biscuits')
            .then((fullRes) => {
              if (cancelled) return;
              const fullList = fullRes.data?.data?.biscuits || [];
              const withImages = mergeImages(merged, fullList).filter(b => b.disponible !== false);
              if (hasAnyImage(withImages)) {
                setBiscuits(withImages);
                try {
                  localStorage.setItem('snackin_biscuits', JSON.stringify({ data: withImages, at: Date.now() }));
                } catch (_) {}
              }
            })
            .catch(() => {
              // Best effort seulement : on garde la liste light en cas d'erreur.
            });
        }

        const prix = tarifsRes.data?.data?.prixBoites;
        if (prix && typeof prix[4] === 'number' && typeof prix[6] === 'number' && typeof prix[12] === 'number') {
          setPrixBoites({ 4: prix[4], 6: prix[6], 12: prix[12] });
          try {
            localStorage.setItem('snackin_tarifs_boites', JSON.stringify({ data: prix, at: Date.now() }));
          } catch (_) {}
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Erreur chargement Commander:', error);
          setBiscuits([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadInitialData();
    return () => { cancelled = true; };
  }, []);

  // Parser "YYYY-MM-DD" en date locale (évite d'afficher mercredi au lieu de jeudi)
  const parseLocalDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('T')[0].split('-').map(Number);
    if (parts.length !== 3) return new Date(dateStr);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };

  const formatLocalDateStr = (dateStr, options = { weekday: 'long', day: 'numeric', month: 'long' }) => {
    const d = parseLocalDate(dateStr);
    return d ? d.toLocaleDateString('fr-FR', options) : '';
  };

  const lieuRamassageSelectionne = lieuxRamassage.find((l) => l.pointRamassage === pointRamassage);

  const libellePointRamassage = (slug) => {
    const lieu = lieuxRamassage.find((l) => l.pointRamassage === slug);
    return libellePointAvecAdresse(lieu, slug);
  };

  const lieuAdresseParCourriel = (slug) => {
    const lieu = lieuxRamassage.find((l) => l.pointRamassage === slug);
    return isAdresseParCourriel(lieu) || isAdresseParCourriel({ pointRamassage: slug });
  };

  // Charger les points de ramassage configurés par l'admin
  useEffect(() => {
    if (currentStep !== 2) return;
    const loadLieux = async () => {
      try {
        const response = await api.get('/horaires/lieux');
        setLieuxRamassage(response.data?.data?.lieux || []);
      } catch (err) {
        console.error('Erreur chargement lieux ramassage:', err);
        setLieuxRamassage([]);
      }
    };
    loadLieux();
  }, [currentStep]);

  // Charger les dates disponibles quand le lieu change
  useEffect(() => {
    if (pointRamassage) {
      fetchDatesDisponibles();
      setDateRamassage('');
      setHeureRamassage('');
      setHeuresDisponibles([]);
    } else {
      setDatesDisponibles([]);
      setDateRamassage('');
      setHeureRamassage('');
      setHeuresDisponibles([]);
    }
  }, [pointRamassage]);

  // Charger les horaires disponibles quand la date change
  useEffect(() => {
    if (pointRamassage && dateRamassage) {
      fetchHoraires();
    } else {
      setHeuresDisponibles([]);
      setHeureRamassage('');
    }
  }, [pointRamassage, dateRamassage]);

  const fetchDatesDisponibles = async () => {
    try {
      const response = await api.get(`/horaires/dates?pointRamassage=${pointRamassage}`);
      setDatesDisponibles(response.data.data.dates || []);
    } catch (error) {
      console.error('Erreur lors du chargement des dates:', error);
      setDatesDisponibles([]);
    }
  };

  const fetchHoraires = async () => {
    try {
      const response = await api.get(`/horaires?pointRamassage=${pointRamassage}&date=${dateRamassage}`);
      setHeuresDisponibles(response.data.data.heures || []);
      setHeureRamassage(''); // Réinitialiser l'heure sélectionnée
    } catch (error) {
      console.error('Erreur lors du chargement des horaires:', error);
      setHeuresDisponibles([]);
    }
  };

  const fetchBiscuits = async () => {
    try {
      const response = await api.get('/biscuits?light=1');
      const list = response.data?.data?.biscuits || [];
      setBiscuits(list.filter(b => b.disponible !== false));
    } catch (error) {
      console.error('Erreur chargement biscuits:', error);
      setBiscuits([]);
    } finally {
      setLoading(false);
    }
  };

  // URL d'image : support data: et http, ou chemin relatif vers l'API
  const getBiscuitImageUrl = (biscuit) => {
    if (!biscuit?.image) return null;
    const img = biscuit.image;
    if (img.startsWith('data:') || img.startsWith('http://') || img.startsWith('https://')) return img;
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/?$/, '') || window.location.origin;
    return (base + (img.startsWith('/') ? '' : '/') + img);
  };

  const ajouterBoite = () => {
    setBoites([...boites, {
      id: Date.now(),
      taille: 4,
      prix: prixBoites[4],
      saveurs: []
    }]);
  };

  const supprimerBoite = (boiteId) => {
    setBoites(boites.filter(b => b.id !== boiteId));
  };

  const changerTailleBoite = (boiteId, nouvelleTaille) => {
    setBoites(boites.map(b => 
      b.id === boiteId 
        ? { ...b, taille: nouvelleTaille, prix: prixBoites[nouvelleTaille], saveurs: [] }
        : b
    ));
  };

  const ajouterSaveur = (boiteId, biscuitId) => {
    setBoites(boites.map(b => {
      if (b.id === boiteId) {
        const saveurExistante = b.saveurs.find(s => s.biscuit === biscuitId);
        if (saveurExistante) {
          // Augmenter la quantité
          return {
            ...b,
            saveurs: b.saveurs.map(s =>
              s.biscuit === biscuitId
                ? { ...s, quantite: s.quantite + 1 }
                : s
            )
          };
        } else {
          // Ajouter une nouvelle saveur
          return {
            ...b,
            saveurs: [...b.saveurs, { biscuit: biscuitId, quantite: 1 }]
          };
        }
      }
      return b;
    }));
  };

  const retirerSaveur = (boiteId, biscuitId) => {
    setBoites(boites.map(b => {
      if (b.id === boiteId) {
        const saveurExistante = b.saveurs.find(s => s.biscuit === biscuitId);
        if (saveurExistante && saveurExistante.quantite > 1) {
          // Diminuer la quantité
          return {
            ...b,
            saveurs: b.saveurs.map(s =>
              s.biscuit === biscuitId
                ? { ...s, quantite: s.quantite - 1 }
                : s
            )
          };
        } else {
          // Retirer complètement
          return {
            ...b,
            saveurs: b.saveurs.filter(s => s.biscuit !== biscuitId)
          };
        }
      }
      return b;
    }));
  };

  const getQuantiteSaveur = (boiteId, biscuitId) => {
    const boite = boites.find(b => b.id === boiteId);
    const saveur = boite?.saveurs.find(s => s.biscuit === biscuitId);
    return saveur?.quantite || 0;
  };

  const getTotalSaveursBoite = (boite) => {
    return boite.saveurs.reduce((total, s) => total + s.quantite, 0);
  };

  const calculerTotal = () =>
    boites.reduce((total, boite) => total + boite.prix, 0);

  const getDonneesCommandeEnAttente = () => ({
    boites,
    pointRamassage,
    dateRamassage,
    heureRamassage,
    visiteurNom,
    visiteurEmail,
    visiteurTelephone,
  });

  const sauvegarderCommandeEnAttente = (donnees = getDonneesCommandeEnAttente()) => {
    try {
      sessionStorage.setItem(PENDING_COMMANDE_KEY, JSON.stringify(donnees));
    } catch (err) {
      console.warn('Impossible de sauvegarder la commande en attente:', err);
    }
  };

  const effacerCommandeEnAttente = () => {
    sessionStorage.removeItem(PENDING_COMMANDE_KEY);
  };

  useEffect(() => {
    if (currentStep === 3) {
      sauvegarderCommandeEnAttente();
    }
  }, [currentStep, boites, pointRamassage, dateRamassage, heureRamassage, visiteurNom, visiteurEmail, visiteurTelephone]);

  const preparerCommandePourPaiement = async (donnees = getDonneesCommandeEnAttente()) => {
    const boitesFormatees = donnees.boites.map(boite => ({
      taille: boite.taille,
      prix: boite.prix,
      saveurs: boite.saveurs.map(s => ({
        biscuit: s.biscuit,
        quantite: s.quantite,
      })),
    }));

    const dateComplete = new Date(`${donnees.dateRamassage}T${donnees.heureRamassage}:00`);
    const total = donnees.boites.reduce((sum, boite) => sum + boite.prix, 0);

    const commandeData = {
      boites: boitesFormatees,
      typeReception: TYPE_RECEPTION,
      methodePaiement: METHODE_PAIEMENT,
      total,
      pointRamassage: donnees.pointRamassage,
      dateRamassage: dateComplete.toISOString(),
      heureRamassage: donnees.heureRamassage,
    };

    if (!user) {
      commandeData.visiteurNom = donnees.visiteurNom;
      commandeData.visiteurEmail = donnees.visiteurEmail;
      if (donnees.visiteurTelephone) {
        commandeData.visiteurTelephone = donnees.visiteurTelephone;
      }
    }

    const response = await api.post('/commandes/preparer', commandeData);
    if (response.data?.data?.commande?._id) {
      return response.data.data.commande._id;
    }
    throw new Error('Impossible de préparer la commande');
  };

  const finaliserCommandePayee = async (paymentIntentId) => {
    const response = await api.post('/paiement/finaliser', { paymentIntentId });
    if (response.data?.data?.commande) {
      effacerCommandeEnAttente();
      const commande = response.data.data.commande;
      setCommandeCreee({
        numero: commande._id,
        total: commande.total,
        _id: commande._id,
        ...commande,
      });
      setPaiementEnCours(false);
      setError('');
      setCurrentStep(4);
      return commande;
    }
    throw new Error('Réponse invalide du serveur');
  };

  useEffect(() => {
    if (currentStep < 3) {
      setCommandeEnAttenteId(null);
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== 3 || commandeEnAttenteId) return;
    if (!user && (!visiteurNom || !visiteurEmail)) return;

    let cancelled = false;

    const preparer = async () => {
      setPreparationPaiement(true);
      setError('');
      try {
        sauvegarderCommandeEnAttente();
        const id = await preparerCommandePourPaiement();
        if (!cancelled) {
          setCommandeEnAttenteId(id);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Erreur préparation commande:', err);
          const errorMessage = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Erreur lors de la préparation de la commande';
          setError(errorMessage);
        }
      } finally {
        if (!cancelled) {
          setPreparationPaiement(false);
        }
      }
    };

    preparer();
    return () => { cancelled = true; };
  }, [currentStep, commandeEnAttenteId, user, visiteurNom, visiteurEmail, visiteurTelephone, boites, pointRamassage, dateRamassage, heureRamassage]);

  const creerCommandeApresPaiement = async (stripePaymentIntentId) => {
    await finaliserCommandePayee(stripePaymentIntentId);
  };

  useEffect(() => {
    const finaliserRetourStripe = async () => {
      const params = new URLSearchParams(window.location.search);
      const paymentIntentId = params.get('payment_intent');
      const redirectStatus = params.get('redirect_status');

      if (!paymentIntentId || redirectStatus !== 'succeeded') return;

      window.history.replaceState({}, '', window.location.pathname);

      try {
        setCurrentStep(3);
        await finaliserCommandePayee(paymentIntentId);
      } catch (err) {
        console.error('Erreur finalisation retour Stripe:', err);
        const errorMessage = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Erreur lors de la finalisation de la commande après paiement';
        setError(errorMessage);
      }
    };

    finaliserRetourStripe();
  }, []);

  const validerBoites = () => {
    if (boites.length === 0) {
      setError('Veuillez ajouter au moins une boîte');
      return;
    }

    for (const boite of boites) {
      const totalSaveurs = getTotalSaveursBoite(boite);
      if (totalSaveurs !== boite.taille) {
        setError(`La boîte de ${boite.taille} doit contenir exactement ${boite.taille} biscuits`);
        return;
      }
    }

    setError('');
    setCurrentStep(2);
  };

  const validerReception = () => {
    if (!pointRamassage || !dateRamassage || !heureRamassage) {
      setError('Veuillez remplir tous les champs de ramassage');
      return;
    }
    setError('');
    setCurrentStep(3);
  };

  const validerInfosVisiteur = () => {
    if (user) return true;
    if (!visiteurNom || !visiteurEmail) {
      setError('Veuillez remplir votre nom et votre email');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(visiteurEmail)) {
      setError('Veuillez entrer un email valide');
      return false;
    }
    return true;
  };

  const handlePaiementSuccess = async (paymentIntent) => {
    if (!validerInfosVisiteur()) {
      setPaiementEnCours(true);
      return;
    }
    try {
      setError('');
      setPaiementEnCours(false);
      await creerCommandeApresPaiement(paymentIntent.id);
    } catch (err) {
      console.error('Erreur création commande:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Erreur lors de la création de la commande';
      setError(errorMessage);
      setPaiementEnCours(true);
    }
  };

  const handlePaiementError = (errorMessage) => {
    setError(errorMessage);
    setPaiementEnCours(false);
  };

  const handleSubmit = async (e, stripePaymentIntentId = null) => {
    if (e) e.preventDefault();

    if (!stripePaymentIntentId) {
      setError('Le paiement en ligne est requis pour confirmer la commande');
      return;
    }

    try {
      sauvegarderCommandeEnAttente();
      await creerCommandeApresPaiement(stripePaymentIntentId);
    } catch (error) {
      console.error('Erreur lors de la commande:', error);
      let errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg;
      if (!errorMessage) {
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          errorMessage = 'Serveur inaccessible. Démarrez le backend (dans le dossier backend : npm run dev) puis réessayez.';
        } else {
          errorMessage = 'Erreur lors de la création de la commande. Réessayez.';
        }
      }
      setError(errorMessage);
      setPaiementEnCours(true);
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="commander-page">
      <h1>🛒 Commander</h1>

      {/* Indicateur de progression */}
      <div className="steps-indicator">
        <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
          <span className="step-number">1</span>
          <span className="step-label">Boîtes</span>
        </div>
        <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
          <span className="step-number">2</span>
          <span className="step-label">Ramassage</span>
        </div>
        <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">Paiement</span>
        </div>
        {currentStep >= 4 && (
          <div className={`step ${currentStep >= 4 ? 'active' : ''}`}>
            <span className="step-number">4</span>
            <span className="step-label">Confirmation</span>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Étape 1: Sélection des boîtes */}
      {currentStep === 1 && (
        <div className="commander-step">
          <h2>Choisissez vos boîtes</h2>
          <p className="step-description desktop-only">
            Les biscuits sont vendus en boîtes de 4, 6 ou 12. 
            Choisissez la taille de votre boîte, puis sélectionnez les saveurs.
          </p>
          <p className="step-description-mobile mobile-only">Boîtes 4, 6 ou 12 — choisissez vos saveurs.</p>

          {boites.length === 0 && (
            <div className="commander-first-box-cta">
              <p className="desktop-only">Cliquez ci-dessous pour ajouter votre première boîte.</p>
              <button
                type="button"
                onClick={ajouterBoite}
                className="btn btn-primary btn-add-first"
              >
                Ajouter une boîte
              </button>
            </div>
          )}

          {boites.map((boite) => {
            const totalSaveurs = getTotalSaveursBoite(boite);
            const reste = boite.taille - totalSaveurs;

            return (
              <div key={boite.id} className="boite-card">
                <div className="boite-header">
                  <h3>Boîte de {boite.taille} biscuits - {boite.prix.toFixed(2)} $</h3>
                  <button
                    type="button"
                    onClick={() => supprimerBoite(boite.id)}
                    className="btn-remove"
                  >
                    ✕ Supprimer
                  </button>
                </div>

                <div className="boite-taille">
                  <label>Taille de la boîte:</label>
                  <div className="taille-options">
                    {[4, 6, 12].map(taille => (
                      <button
                        key={taille}
                        type="button"
                        className={`taille-btn ${boite.taille === taille ? 'active' : ''}`}
                        onClick={() => changerTailleBoite(boite.id, taille)}
                      >
                        {taille} biscuits
                      </button>
                    ))}
                  </div>
                </div>

                <div className="boite-saveurs">
                  <label>Choisissez vos saveurs ({reste} restant{reste > 1 ? 's' : ''}):</label>
                  {biscuits.length === 0 ? (
                    <p className="no-biscuits-msg">
                      <span className="desktop-only">Aucun biscuit disponible. Vérifiez que le serveur est démarré et que des biscuits sont en vente.</span>
                      <span className="mobile-only">Aucun biscuit disponible pour le moment.</span>
                    </p>
                  ) : (
                  <div className="saveurs-grid">
                    {biscuits.map((biscuit) => {
                      const quantite = getQuantiteSaveur(boite.id, biscuit._id);
                      const imageUrl = getBiscuitImageUrl(biscuit);
                      return (
                        <div key={biscuit._id} className="saveur-item">
                          <div className="saveur-item-image">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={biscuit.nom}
                                loading="lazy"
                                decoding="async"
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling?.classList.add('show'); }}
                              />
                            ) : null}
                            <span className={`saveur-item-placeholder ${!imageUrl ? 'show' : ''}`}>🍪</span>
                          </div>
                          <div className="saveur-info">
                            <strong>{biscuit.nom}</strong>
                            {biscuit.saveur && <span className="saveur-tag">{biscuit.saveur}</span>}
                          </div>
                          <div className="saveur-controls">
                            {quantite > 0 && (
                              <button
                                type="button"
                                onClick={() => retirerSaveur(boite.id, biscuit._id)}
                                className="btn-quantity"
                              >
                                -
                              </button>
                            )}
                            {quantite > 0 && <span className="quantite-badge">{quantite}</span>}
                            <button
                              type="button"
                              onClick={() => ajouterSaveur(boite.id, biscuit._id)}
                              disabled={reste === 0}
                              className="btn-quantity"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>

                {reste === 0 && (
                  <div className="boite-complete">
                    ✓ Boîte complète ({boite.taille} biscuits)
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={ajouterBoite}
            className="btn btn-secondary"
          >
            + Ajouter une autre boîte
          </button>

          {boites.length > 0 && (
            <div className="step-actions">
              <div className="total-preview">
                <strong>Total: {calculerTotal().toFixed(2)} $</strong>
              </div>
              <button
                type="button"
                onClick={validerBoites}
                className="btn btn-primary"
              >
                Continuer →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Étape 2: Ramassage */}
      {currentStep === 2 && (
        <div className="commander-step">
          <h2>📍 Ramassage</h2>
          <p className="step-intro">Récupérez votre commande à un point de ramassage.</p>

          <div className="form-group">
            <label>Point de ramassage *</label>
            {lieuxRamassage.length === 0 ? (
              <p className="no-dates">
                Aucun point de ramassage disponible. L&apos;administrateur doit d&apos;abord ajouter des horaires.
              </p>
            ) : (
              <select
                value={pointRamassage}
                onChange={(e) => {
                  setPointRamassage(e.target.value);
                  setHeureRamassage('');
                }}
                required
                className="form-select"
              >
                <option value="">Sélectionnez un lieu</option>
                {lieuxRamassage.map((lieu) => (
                  <option key={lieu.pointRamassage} value={lieu.pointRamassage}>
                    {libellePointAvecAdresse(lieu, lieu.pointRamassage)}
                  </option>
                ))}
              </select>
            )}
            {lieuRamassageSelectionne && isAdresseParCourriel(lieuRamassageSelectionne) && (
              <p className="pickup-address-hint pickup-address-private">
                📧 {MESSAGE_ADRESSE_PAR_COURRIEL}
              </p>
            )}
            {lieuRamassageSelectionne?.adresse && !isAdresseParCourriel(lieuRamassageSelectionne) && (
              <p className="pickup-address-hint">
                📍 {lieuRamassageSelectionne.adresse}, {lieuRamassageSelectionne.ville}
              </p>
            )}
          </div>

          {pointRamassage && (
            <>
              <div className="form-group">
                <label>Date de ramassage *</label>
                {datesDisponibles.length === 0 ? (
                  <div className="no-dates">
                    <p>Aucune date disponible pour ce lieu. Veuillez choisir un autre lieu.</p>
                  </div>
                ) : (
                  <div className="dates-list">
                    {datesDisponibles.map(date => (
                      <button
                        key={date}
                        type="button"
                        className={`date-btn ${dateRamassage === date ? 'active' : ''}`}
                        onClick={() => setDateRamassage(date)}
                      >
                        {formatLocalDateStr(date)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {dateRamassage && (
                <div className="form-group">
                  <label>Heure de ramassage *</label>
                  {heuresDisponibles.length === 0 ? (
                    <div className="no-hours">
                      <p>Aucun horaire disponible pour cette date. Veuillez choisir une autre date.</p>
                    </div>
                  ) : (
                    <select
                      value={heureRamassage}
                      onChange={(e) => setHeureRamassage(e.target.value)}
                      required
                      className="form-select"
                    >
                      <option value="">Sélectionnez une heure</option>
                      {heuresDisponibles.map(heure => (
                        <option key={heure} value={heure}>{heure}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </>
          )}

          <div className="step-actions">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="btn btn-secondary"
            >
              ← Retour
            </button>
            <button
              type="button"
              onClick={validerReception}
              className="btn btn-primary"
            >
              Continuer →
            </button>
          </div>
        </div>
      )}

      {/* Étape 3: Paiement en ligne */}
      {currentStep === 3 && (
        <div className="commander-step">
          <h2>💳 Paiement en ligne</h2>
          <p className="step-intro">
            Toutes les commandes sont payées en ligne de façon sécurisée (Stripe).
          </p>

          {!user && (
            <div className="visiteur-infos">
              <h3>Informations de contact</h3>
              <div className="form-group">
                <label>Nom complet *</label>
                <input
                  type="text"
                  value={visiteurNom}
                  onChange={(e) => setVisiteurNom(e.target.value)}
                  required
                  className="form-input"
                  placeholder="Votre nom"
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={visiteurEmail}
                  onChange={(e) => setVisiteurEmail(e.target.value)}
                  required
                  className="form-input"
                  placeholder="votre@email.com"
                />
                <small className="desktop-only">Nous vous enverrons la confirmation de commande par email</small>
              </div>
              <div className="form-group">
                <label>Téléphone (optionnel)</label>
                <input
                  type="tel"
                  value={visiteurTelephone}
                  onChange={(e) => setVisiteurTelephone(e.target.value)}
                  className="form-input"
                  placeholder="(514) 123-4567"
                />
              </div>
            </div>
          )}

          <div className="commande-resume">
            <h3>Résumé de votre commande</h3>
            <div className="resume-item">
              <span>Nombre de boîtes:</span>
              <strong>{boites.length}</strong>
            </div>
            <div className="resume-item">
              <span>Point de ramassage:</span>
              <strong>{libellePointRamassage(pointRamassage)}</strong>
            </div>
            {lieuAdresseParCourriel(pointRamassage) && (
              <div className="resume-item resume-note">
                <span>Adresse:</span>
                <strong>{MESSAGE_ADRESSE_PAR_COURRIEL}</strong>
              </div>
            )}
            <div className="resume-item">
              <span>Date et heure:</span>
              <strong>{formatLocalDateStr(dateRamassage)} à {heureRamassage}</strong>
            </div>
            <div className="resume-item resume-total">
              <span>Total à payer:</span>
              <strong>{calculerTotal().toFixed(2)} $</strong>
            </div>
          </div>

          <div className="stripe-payment-section">
            <h3>Paiement sécurisé</h3>
            {preparationPaiement || (!commandeEnAttenteId && (!user && (!visiteurNom || !visiteurEmail))) ? (
              <div className="stripe-loading">
                <p>
                  {!user && (!visiteurNom || !visiteurEmail)
                    ? 'Veuillez remplir votre nom et email pour continuer.'
                    : 'Préparation du paiement...'}
                </p>
              </div>
            ) : commandeEnAttenteId ? (
              <StripeCheckout
                montant={calculerTotal()}
                commandeId={commandeEnAttenteId}
                onSuccess={handlePaiementSuccess}
                onError={handlePaiementError}
              />
            ) : (
              <div className="stripe-loading">
                <p>Impossible d'initialiser le paiement. Veuillez rafraîchir la page.</p>
              </div>
            )}
          </div>

          <div className="step-actions">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="btn btn-secondary"
            >
              ← Retour
            </button>
          </div>
        </div>
      )}

      {/* Étape 4: Confirmation et proposition d'inscription */}
      {currentStep === 4 && commandeCreee && (
        <div className="commander-step confirmation-step">
          <div className="confirmation-success">
            <h2>✅ Commande confirmée !</h2>
            <p className="commande-numero">
              Numéro de commande: <strong>#{commandeCreee.numero ? commandeCreee.numero.slice(-6) : commandeCreee._id?.slice(-6) || 'N/A'}</strong>
            </p>
            <p>Un email de confirmation a été envoyé à {user ? user.email : visiteurEmail}
              {lieuAdresseParCourriel(commandeCreee.pointRamassage)
                ? ' avec l\'adresse de ramassage.'
                : '.'}
            </p>
          </div>

          <div className="commande-resume">
            <h3>Détails de votre commande</h3>
            <div className="resume-item">
              <span>Point de ramassage:</span>
              <strong>{libellePointRamassage(commandeCreee.pointRamassage)}</strong>
            </div>
            {lieuAdresseParCourriel(commandeCreee.pointRamassage) && (
              <div className="resume-item resume-note">
                <span>Adresse:</span>
                <strong>{MESSAGE_ADRESSE_PAR_COURRIEL}</strong>
              </div>
            )}
            <div className="resume-item">
              <span>Date et heure:</span>
              <strong>{commandeCreee.dateRamassage ? `${new Date(commandeCreee.dateRamassage).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${commandeCreee.heureRamassage}` : 'N/A'}</strong>
            </div>
            <div className="resume-item">
              <span>Paiement:</span>
              <strong>💳 Paiement en ligne (Stripe)</strong>
            </div>
            <div className="resume-item">
              <span>Statut du paiement:</span>
              <strong style={{ color: '#28a745' }}>✅ Paiement confirmé</strong>
            </div>
            <div className="resume-item resume-total">
              <span>Total:</span>
              <strong>{commandeCreee.total ? commandeCreee.total.toFixed(2) : calculerTotal().toFixed(2)} $</strong>
            </div>
          </div>

          {!user && (
            <div className="inscription-proposition">
              <h3>💡 Créer un compte ?</h3>
              <p>
                Créez un compte gratuit pour suivre vos commandes, 
                accéder à votre historique et bénéficier d'avantages exclusifs !
              </p>
              <div className="inscription-actions">
                <Link to={`/register?email=${encodeURIComponent(visiteurEmail)}&nom=${encodeURIComponent(visiteurNom)}`} className="btn btn-primary">
                  Créer un compte
                </Link>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="btn btn-secondary"
                >
                  Continuer en mode visiteur
                </button>
              </div>
              <p className="inscription-note">
                Vous pouvez toujours créer un compte plus tard en utilisant votre email: <strong>{visiteurEmail}</strong>
              </p>
            </div>
          )}

          {user && (
            <div className="step-actions">
              <Link to="/mes-commandes" className="btn btn-primary">
                Voir mes commandes
              </Link>
              <Link to="/" className="btn btn-secondary">
                Retour à l'accueil
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Commander;
