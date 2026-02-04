import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StripeCheckout from '../components/StripeCheckout';
import './Commander.css';

const Commander = () => {
  const { user } = useAuth();
  const [biscuits, setBiscuits] = useState([]);
  const [boites, setBoites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1); // 1: boîtes, 2: réception, 3: paiement/infos, 4: confirmation
  const [typeReception, setTypeReception] = useState(''); // 'ramassage' ou 'livraison'
  const [pointRamassage, setPointRamassage] = useState('');
  const [dateRamassage, setDateRamassage] = useState('');
  const [heureRamassage, setHeureRamassage] = useState('');
  // Pour la livraison
  const [villeLivraison, setVilleLivraison] = useState('');
  const [adresseLivraison, setAdresseLivraison] = useState({
    rue: '',
    codePostal: '',
    instructions: '',
  });
  const [dateLivraison, setDateLivraison] = useState('');
  const [heureLivraison, setHeureLivraison] = useState('');
  const [methodePaiement, setMethodePaiement] = useState('');
  const [heuresDisponibles, setHeuresDisponibles] = useState([]);
  const [datesDisponibles, setDatesDisponibles] = useState([]);
  const [datesLivraisonDisponibles, setDatesLivraisonDisponibles] = useState([]);
  const [fraisLivraison, setFraisLivraison] = useState(0);
  const [error, setError] = useState('');
  // Informations visiteur
  const [visiteurNom, setVisiteurNom] = useState('');
  const [visiteurEmail, setVisiteurEmail] = useState('');
  const [visiteurTelephone, setVisiteurTelephone] = useState('');
  const [commandeCreee, setCommandeCreee] = useState(null);
  const [paiementEnCours, setPaiementEnCours] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBiscuits();
    genererDatesLivraison();
  }, []);

  // Générer les jeudis disponibles pour la livraison (prochains 8 jeudis)
  const genererDatesLivraison = () => {
    const dates = [];
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    
    // Trouver le prochain jeudi
    let prochainJeudi = new Date(aujourdhui);
    const jourActuel = aujourdhui.getDay(); // 0 = dimanche, 4 = jeudi
    
    // Si on est avant jeudi, aller au jeudi de cette semaine
    // Si on est jeudi ou après, aller au jeudi de la semaine prochaine
    if (jourActuel < 4) {
      prochainJeudi.setDate(aujourdhui.getDate() + (4 - jourActuel));
    } else if (jourActuel === 4) {
      // Si c'est jeudi, vérifier l'heure - si avant 18h, on peut livrer aujourd'hui
      const maintenant = new Date();
      if (maintenant.getHours() < 18) {
        prochainJeudi = aujourdhui;
      } else {
        prochainJeudi.setDate(aujourdhui.getDate() + 7);
      }
    } else {
      prochainJeudi.setDate(aujourdhui.getDate() + (7 - jourActuel + 4));
    }
    
    // Générer 8 jeudis consécutifs
    for (let i = 0; i < 8; i++) {
      const jeudi = new Date(prochainJeudi);
      jeudi.setDate(prochainJeudi.getDate() + (i * 7));
      dates.push(jeudi.toISOString().split('T')[0]);
    }
    
    setDatesLivraisonDisponibles(dates);
  };

  // Charger les dates disponibles quand le lieu change (pour ramassage)
  useEffect(() => {
    if (typeReception === 'ramassage' && pointRamassage) {
      fetchDatesDisponibles();
      setDateRamassage(''); // Réinitialiser la date
      setHeureRamassage(''); // Réinitialiser l'heure
      setHeuresDisponibles([]);
    } else if (typeReception === 'ramassage') {
      setDatesDisponibles([]);
      setDateRamassage('');
      setHeureRamassage('');
      setHeuresDisponibles([]);
    }
  }, [pointRamassage, typeReception]);

  // Calculer les frais de livraison quand la date change (toujours 5$ car jeudi après 18h)
  useEffect(() => {
    if (typeReception === 'livraison' && dateLivraison) {
      // Définir l'heure par défaut à 18:00 si non définie
      if (!heureLivraison) {
        setHeureLivraison('18:00');
      }
      // Toutes les livraisons sont jeudi après 18h, donc toujours 5$
      setFraisLivraison(5);
    } else {
      setFraisLivraison(0);
    }
  }, [typeReception, dateLivraison]);

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
      const response = await api.get('/biscuits');
      setBiscuits(response.data.data.biscuits.filter(b => b.disponible));
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prix des boîtes
  const prixBoites = {
    4: 15.00,
    6: 20.00,
    12: 35.00
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

  const calculerTotal = () => {
    const totalBoites = boites.reduce((total, boite) => total + boite.prix, 0);
    return totalBoites + fraisLivraison;
  };

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
    if (typeReception === 'ramassage') {
      if (!pointRamassage || !dateRamassage || !heureRamassage) {
        setError('Veuillez remplir tous les champs de ramassage');
        return;
      }
    } else if (typeReception === 'livraison') {
      if (!villeLivraison || !adresseLivraison.rue || !adresseLivraison.codePostal || !dateLivraison) {
        setError('Veuillez remplir tous les champs de livraison');
        return;
      }
      // Définir une heure par défaut si non spécifiée (18:00)
      if (!heureLivraison) {
        setHeureLivraison('18:00');
      }
    } else {
      setError('Veuillez choisir un type de réception');
      return;
    }
    setError('');
    setCurrentStep(3);
  };

  const validerInfos = () => {
    if (!user) {
      // Vérifier les informations du visiteur
      if (!visiteurNom || !visiteurEmail) {
        setError('Veuillez remplir votre nom et votre email');
        return;
      }
      // Validation basique de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(visiteurEmail)) {
        setError('Veuillez entrer un email valide');
        return;
      }
    }
    if (!methodePaiement) {
      setError('Veuillez choisir une méthode de paiement');
      return;
    }
    setError('');
    
    // Si paiement en ligne, activer le formulaire Stripe si pas déjà activé
    // Sinon, passer à l'étape 4 (confirmation)
    if (methodePaiement === 'en_ligne') {
      if (!paiementEnCours) {
        setPaiementEnCours(true);
      }
      // Ne pas passer à l'étape suivante, rester pour le paiement
    } else {
      setCurrentStep(4);
    }
  };

  const handlePaiementSuccess = async (paymentIntent) => {
    // Créer la commande après paiement réussi
    try {
      setError(''); // Réinitialiser les erreurs
      setPaiementEnCours(false); // Désactiver le formulaire de paiement
      
      // Créer la commande avec le paymentIntentId
      await handleSubmit(null, paymentIntent.id);
      // handleSubmit devrait maintenant passer à l'étape 4 automatiquement
    } catch (err) {
      console.error('Erreur création commande:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Erreur lors de la création de la commande';
      setError(errorMessage);
      setPaiementEnCours(true); // Réactiver le formulaire en cas d'erreur
    }
  };

  const handlePaiementError = (errorMessage) => {
    setError(errorMessage);
    setPaiementEnCours(false);
  };

  const handleSubmit = async (e, stripePaymentIntentId = null) => {
    if (e) e.preventDefault();
    
    try {
      // Convertir les boîtes au format attendu par le backend
      const boitesFormatees = boites.map(boite => ({
        taille: boite.taille,
        prix: boite.prix,
        saveurs: boite.saveurs.map(s => ({
          biscuit: s.biscuit,
          quantite: s.quantite
        }))
      }));

      // Créer la date complète de ramassage
      const dateComplete = new Date(`${dateRamassage}T${heureRamassage}:00`);

      const commandeData = {
        boites: boitesFormatees,
        typeReception: typeReception,
        methodePaiement: methodePaiement,
        total: calculerTotal(),
        paiementConfirme: methodePaiement === 'sur_place' ? false : (stripePaymentIntentId ? true : false),
        stripePaymentIntentId: stripePaymentIntentId || null,
      };

      // Ajouter les données selon le type de réception
      if (typeReception === 'ramassage') {
        const dateComplete = new Date(`${dateRamassage}T${heureRamassage}:00`);
        commandeData.pointRamassage = pointRamassage;
        commandeData.dateRamassage = dateComplete.toISOString();
        commandeData.heureRamassage = heureRamassage;
      } else {
        const dateCompleteLivraison = new Date(`${dateLivraison}T${heureLivraison}:00`);
        commandeData.villeLivraison = villeLivraison;
        commandeData.adresseLivraison = adresseLivraison;
        commandeData.dateLivraison = dateCompleteLivraison.toISOString();
        commandeData.heureLivraison = heureLivraison;
      }

      // Ajouter les informations visiteur si pas connecté
      if (!user) {
        commandeData.visiteurNom = visiteurNom;
        commandeData.visiteurEmail = visiteurEmail;
        if (visiteurTelephone) {
          commandeData.visiteurTelephone = visiteurTelephone;
        }
      }

      const response = await api.post('/commandes', commandeData);
      
      // Si paiement en ligne réussi, passer à l'étape de confirmation
      if (methodePaiement === 'en_ligne' && stripePaymentIntentId) {
        // S'assurer que la commande a bien été créée
        if (response.data && response.data.data && response.data.data.commande) {
          setCommandeCreee({
            numero: response.data.data.commande._id,
            total: calculerTotal(),
            _id: response.data.data.commande._id,
            ...response.data.data.commande,
          });
          setPaiementEnCours(false);
          setError(''); // Réinitialiser les erreurs
          setCurrentStep(4); // Passer à l'étape de confirmation
        } else {
          throw new Error('Réponse invalide du serveur');
        }
      } else if (methodePaiement === 'sur_place') {
        // Afficher la page de confirmation
        if (response.data && response.data.data && response.data.data.commande) {
          setCommandeCreee({
            numero: response.data.data.commande._id,
            total: calculerTotal(),
            _id: response.data.data.commande._id,
            ...response.data.data.commande,
          });
          setError(''); // Réinitialiser les erreurs
          setCurrentStep(4); // Passer à l'étape de confirmation
        } else {
          throw new Error('Réponse invalide du serveur');
        }
      }
    } catch (error) {
      console.error('Erreur lors de la commande:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Erreur lors de la création de la commande';
      console.error('Détails de l\'erreur:', error.response?.data);
      setError(errorMessage);
      // Si c'est une erreur de validation, réactiver le formulaire de paiement
      if (error.response?.status === 400 && methodePaiement === 'en_ligne') {
        setPaiementEnCours(true);
      }
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
          <span className="step-label">Réception</span>
        </div>
        <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">{user ? 'Paiement' : 'Informations'}</span>
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
          <p className="step-description">
            Les biscuits sont vendus en boîtes de 4, 6 ou 12. 
            Choisissez la taille de votre boîte, puis sélectionnez les saveurs.
          </p>

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
                  <div className="saveurs-grid">
                    {biscuits.map((biscuit) => {
                      const quantite = getQuantiteSaveur(boite.id, biscuit._id);
                      return (
                        <div key={biscuit._id} className="saveur-item">
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

      {/* Étape 2: Réception (Ramassage ou Livraison) */}
      {currentStep === 2 && (
        <div className="commander-step">
          <h2>Type de réception</h2>

          <div className="reception-options">
            <label className="reception-option">
              <input
                type="radio"
                name="reception"
                value="ramassage"
                checked={typeReception === 'ramassage'}
                onChange={(e) => {
                  setTypeReception(e.target.value);
                  setPointRamassage('');
                  setDateRamassage('');
                  setHeureRamassage('');
                }}
              />
              <div className="reception-card">
                <strong>📍 Ramassage</strong>
                <p>Récupérez votre commande à un point de ramassage</p>
              </div>
            </label>

            <label className="reception-option">
              <input
                type="radio"
                name="reception"
                value="livraison"
                checked={typeReception === 'livraison'}
                onChange={(e) => {
                  setTypeReception(e.target.value);
                  setVilleLivraison('');
                  setAdresseLivraison({ rue: '', codePostal: '', instructions: '' });
                  setDateLivraison('');
                  setHeureLivraison('');
                }}
              />
              <div className="reception-card">
                <strong>🚚 Livraison</strong>
                <p>Livraison à domicile (5$ les jeudis après 18h)</p>
              </div>
            </label>
          </div>

          {/* Formulaire Ramassage */}
          {typeReception === 'ramassage' && (
            <>
              <div className="form-group">
                <label>Point de ramassage *</label>
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
                  <option value="laval">Laval</option>
                  <option value="montreal">Montréal</option>
                  <option value="repentigny">Repentigny</option>
                </select>
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
                            {new Date(date).toLocaleDateString('fr-FR', { 
                              weekday: 'long', 
                              day: 'numeric', 
                              month: 'long' 
                            })}
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
            </>
          )}

          {/* Formulaire Livraison */}
          {typeReception === 'livraison' && (
            <>
              <div className="form-group">
                <label>Ville de livraison *</label>
                <select
                  value={villeLivraison}
                  onChange={(e) => setVilleLivraison(e.target.value)}
                  required
                  className="form-select"
                >
                  <option value="">Sélectionnez une ville</option>
                  <option value="montreal">Montréal</option>
                  <option value="laval">Laval</option>
                  <option value="repentigny">Repentigny</option>
                  <option value="assomption">Assomption</option>
                  <option value="terrebonne">Terrebonne</option>
                </select>
              </div>

              <div className="form-group">
                <label>Adresse complète *</label>
                <input
                  type="text"
                  value={adresseLivraison.rue}
                  onChange={(e) => setAdresseLivraison({ ...adresseLivraison, rue: e.target.value })}
                  required
                  className="form-input"
                  placeholder="123 rue Principale"
                />
              </div>

              <div className="form-group">
                <label>Code postal *</label>
                <input
                  type="text"
                  value={adresseLivraison.codePostal}
                  onChange={(e) => setAdresseLivraison({ ...adresseLivraison, codePostal: e.target.value })}
                  required
                  className="form-input"
                  placeholder="H1A 1A1"
                  pattern="[A-Za-z][0-9][A-Za-z] [0-9][A-Za-z][0-9]"
                />
              </div>

              <div className="form-group">
                <label>Instructions de livraison (optionnel)</label>
                <textarea
                  value={adresseLivraison.instructions}
                  onChange={(e) => setAdresseLivraison({ ...adresseLivraison, instructions: e.target.value })}
                  className="form-input"
                  rows="3"
                  placeholder="Ex: Sonner deux fois, laisser à la porte..."
                />
              </div>

              <div className="form-group">
                <label>Date de livraison souhaitée *</label>
                <p className="livraison-info">Les livraisons sont disponibles uniquement les jeudis</p>
                {datesLivraisonDisponibles.length === 0 ? (
                  <div className="no-dates">
                    <p>Aucune date de livraison disponible pour le moment.</p>
                  </div>
                ) : (
                  <div className="dates-list">
                    {datesLivraisonDisponibles.map(date => (
                      <button
                        key={date}
                        type="button"
                        className={`date-btn ${dateLivraison === date ? 'active' : ''}`}
                        onClick={() => {
                          setDateLivraison(date);
                          setHeureLivraison(''); // Réinitialiser l'heure quand on change de date
                        }}
                      >
                        {new Date(date).toLocaleDateString('fr-FR', { 
                          weekday: 'long', 
                          day: 'numeric', 
                          month: 'long' 
                        })}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {dateLivraison && (
                <div className="form-group">
                  <label>Heure de livraison souhaitée *</label>
                  <div className="livraison-heure-highlight">
                    <span className="livraison-heure-icon">🕐</span>
                    <span className="livraison-heure-text">Livraison après 18h</span>
                  </div>
                  {fraisLivraison > 0 && (
                    <small className="frais-livraison-note">
                      ⚠️ Frais de livraison de {fraisLivraison.toFixed(2)} $ appliqués (jeudi après 18h)
                    </small>
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
              disabled={!typeReception}
            >
              Continuer →
            </button>
          </div>
        </div>
      )}

      {/* Étape 3: Informations et Paiement */}
      {currentStep === 3 && (
        <div className="commander-step">
          <h2>{user ? 'Méthode de paiement' : 'Vos informations et paiement'}</h2>

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
                <small>Nous vous enverrons la confirmation de commande par email</small>
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

          <div className="paiement-options">
            <label className="paiement-option">
              <input
                type="radio"
                name="paiement"
                value="sur_place"
                checked={methodePaiement === 'sur_place'}
                onChange={(e) => {
                  setMethodePaiement(e.target.value);
                  setPaiementEnCours(false);
                }}
                required
              />
              <div className="paiement-card">
                <strong>💵 Paiement sur place</strong>
                <p>Vous payez lors du ramassage</p>
              </div>
            </label>

            <label className="paiement-option">
              <input
                type="radio"
                name="paiement"
                value="en_ligne"
                checked={methodePaiement === 'en_ligne'}
                onChange={(e) => {
                  setMethodePaiement(e.target.value);
                  setPaiementEnCours(true);
                }}
                required
              />
              <div className="paiement-card">
                <strong>💳 Paiement en ligne</strong>
                <p>Paiement sécurisé par Stripe</p>
              </div>
            </label>
          </div>

          {methodePaiement === 'en_ligne' && (
            <div className="stripe-payment-section">
              <h3>💳 Paiement sécurisé</h3>
              <StripeCheckout
                montant={calculerTotal()}
                commandeId={null}
                onSuccess={handlePaiementSuccess}
                onError={handlePaiementError}
              />
            </div>
          )}

          {methodePaiement === 'sur_place' && (
            <div className="step-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="btn btn-secondary"
              >
                ← Retour
              </button>
              <button 
                type="button" 
                onClick={async () => {
                  // Valider d'abord
                  if (!user) {
                    if (!visiteurNom || !visiteurEmail) {
                      setError('Veuillez remplir votre nom et votre email');
                      return;
                    }
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(visiteurEmail)) {
                      setError('Veuillez entrer un email valide');
                      return;
                    }
                  }
                  if (!methodePaiement) {
                    setError('Veuillez choisir une méthode de paiement');
                    return;
                  }
                  setError('');
                  // Créer la commande directement
                  await handleSubmit(null, null);
                }}
                className="btn btn-primary"
              >
                Confirmer la commande
              </button>
            </div>
          )}

          {methodePaiement !== 'en_ligne' && (
            <div className="commande-resume">
            <h3>Résumé de votre commande</h3>
            <div className="resume-item">
              <span>Nombre de boîtes:</span>
              <strong>{boites.length}</strong>
            </div>
            <div className="resume-item">
              <span>Type de réception:</span>
              <strong>{typeReception === 'ramassage' ? '📍 Ramassage' : '🚚 Livraison'}</strong>
            </div>
            {typeReception === 'ramassage' ? (
              <>
                <div className="resume-item">
                  <span>Point de ramassage:</span>
                  <strong>{pointRamassage.charAt(0).toUpperCase() + pointRamassage.slice(1)}</strong>
                </div>
                <div className="resume-item">
                  <span>Date et heure:</span>
                  <strong>{new Date(dateRamassage).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {heureRamassage}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="resume-item">
                  <span>Ville:</span>
                  <strong>{villeLivraison.charAt(0).toUpperCase() + villeLivraison.slice(1)}</strong>
                </div>
                <div className="resume-item">
                  <span>Adresse:</span>
                  <strong>{adresseLivraison.rue}, {adresseLivraison.codePostal}</strong>
                </div>
                <div className="resume-item">
                  <span>Date et heure:</span>
                  <strong>{new Date(dateLivraison).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {heureLivraison}</strong>
                </div>
                {fraisLivraison > 0 && (
                  <div className="resume-item">
                    <span>Frais de livraison:</span>
                    <strong>{fraisLivraison.toFixed(2)} $</strong>
                  </div>
                )}
              </>
            )}
            <div className="resume-item resume-total">
              <span>Total:</span>
              <strong>{calculerTotal().toFixed(2)} $</strong>
            </div>
          </div>
          )}
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
            <p>Un email de confirmation a été envoyé à {user ? user.email : visiteurEmail}</p>
          </div>

          <div className="commande-resume">
            <h3>Détails de votre commande</h3>
            <div className="resume-item">
              <span>Type de réception:</span>
              <strong>{commandeCreee.typeReception === 'ramassage' ? '📍 Ramassage' : '🚚 Livraison'}</strong>
            </div>
            {commandeCreee.typeReception === 'ramassage' ? (
              <>
                <div className="resume-item">
                  <span>Point de ramassage:</span>
                  <strong>{commandeCreee.pointRamassage ? commandeCreee.pointRamassage.charAt(0).toUpperCase() + commandeCreee.pointRamassage.slice(1) : 'N/A'}</strong>
                </div>
                <div className="resume-item">
                  <span>Date et heure:</span>
                  <strong>{commandeCreee.dateRamassage ? `${new Date(commandeCreee.dateRamassage).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${commandeCreee.heureRamassage}` : 'N/A'}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="resume-item">
                  <span>Ville:</span>
                  <strong>{commandeCreee.villeLivraison ? commandeCreee.villeLivraison.charAt(0).toUpperCase() + commandeCreee.villeLivraison.slice(1) : 'N/A'}</strong>
                </div>
                <div className="resume-item">
                  <span>Adresse:</span>
                  <strong>{commandeCreee.adresseLivraison ? `${commandeCreee.adresseLivraison.rue}, ${commandeCreee.adresseLivraison.codePostal}` : 'N/A'}</strong>
                </div>
                <div className="resume-item">
                  <span>Date et heure:</span>
                  <strong>{commandeCreee.dateLivraison ? `${new Date(commandeCreee.dateLivraison).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${commandeCreee.heureLivraison || '18:00'}` : 'N/A'}</strong>
                </div>
              </>
            )}
            <div className="resume-item">
              <span>Méthode de paiement:</span>
              <strong>{commandeCreee.methodePaiement === 'en_ligne' ? '💳 Paiement en ligne (Stripe)' : '💵 Paiement sur place'}</strong>
            </div>
            {commandeCreee.paiementConfirme && (
              <div className="resume-item">
                <span>Statut du paiement:</span>
                <strong style={{ color: '#28a745' }}>✅ Paiement confirmé</strong>
              </div>
            )}
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
