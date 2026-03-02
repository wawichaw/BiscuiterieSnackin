import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRecaptcha } from '../hooks/useRecaptcha';
import api from '../services/api';
import './Commentaires.css';

const Commentaires = () => {
  const [commentaires, setCommentaires] = useState([]);
  const [galeriePhotos, setGaleriePhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingGalerie, setLoadingGalerie] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentCommentaireIndex, setCurrentCommentaireIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentGalerieIndex, setCurrentGalerieIndex] = useState(0);
  const carouselRef = useRef(null);
  const photoCarouselRef = useRef(null);
  const galerieRef = useRef(null);
  const { user, isAdmin } = useAuth();
  const { executeRecaptcha } = useRecaptcha();

  // Formulaire simplifié
  const [formData, setFormData] = useState({
    nom: user?.name || '',
    texte: '',
    note: '',
  });
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    fetchCommentaires();
    fetchGalerie();
  }, []);

  const fetchGalerie = async () => {
    try {
      const response = await api.get('/galerie');
      setGaleriePhotos(response.data.data.photos || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoadingGalerie(false);
    }
  };

  // Auto-swipe pour les commentaires (toutes les 5 secondes)
  useEffect(() => {
    if (commentaires.length === 0 || commentaires.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentCommentaireIndex((prev) => (prev + 1) % commentaires.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [commentaires.length]);

  // Fonctions pour le swipe manuel (style iOS)
  const minSwipeDistance = 50;
  const touchStartRef = useRef({});
  const touchEndRef = useRef({});

  const onTouchStart = (e, type) => {
    touchEndRef.current[type] = null;
    touchStartRef.current[type] = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e, type) => {
    touchEndRef.current[type] = e.targetTouches[0].clientX;
  };

  const onTouchEnd = (type) => {
    const start = touchStartRef.current[type];
    const end = touchEndRef.current[type];
    if (!start || !end) return;
    
    const distance = start - end;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (type === 'galerie') {
      if (isLeftSwipe && galeriePhotos.length > 0) {
        setCurrentGalerieIndex((prev) => (prev + 1) % galeriePhotos.length);
      }
      if (isRightSwipe && galeriePhotos.length > 0) {
        setCurrentGalerieIndex((prev) => (prev - 1 + galeriePhotos.length) % galeriePhotos.length);
      }
    } else if (type === 'commentaire') {
      if (isLeftSwipe && commentaires.length > 0) {
        setCurrentCommentaireIndex((prev) => (prev + 1) % commentaires.length);
      }
      if (isRightSwipe && commentaires.length > 0) {
        setCurrentCommentaireIndex((prev) => (prev - 1 + commentaires.length) % commentaires.length);
      }
    } else if (type === 'photo') {
      const currentCommentaire = commentaires[currentCommentaireIndex];
      if (currentCommentaire && currentCommentaire.photos && currentCommentaire.photos.length > 0) {
        if (isLeftSwipe) {
          setCurrentPhotoIndex((prev) => (prev + 1) % currentCommentaire.photos.length);
        }
        if (isRightSwipe) {
          setCurrentPhotoIndex((prev) => (prev - 1 + currentCommentaire.photos.length) % currentCommentaire.photos.length);
        }
      }
    }
    
    // Réinitialiser
    touchStartRef.current[type] = null;
    touchEndRef.current[type] = null;
  };

  // Auto-swipe pour les photos du commentaire actuel (toutes les 5 secondes)
  useEffect(() => {
    const currentCommentaire = commentaires[currentCommentaireIndex];
    if (!currentCommentaire || !currentCommentaire.photos || currentCommentaire.photos.length <= 1) {
      setCurrentPhotoIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentPhotoIndex((prev) => (prev + 1) % currentCommentaire.photos.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [currentCommentaireIndex, commentaires]);

  // Réinitialiser l'index photo quand on change de commentaire
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [currentCommentaireIndex]);

  // Mettre à jour nom si l'utilisateur se connecte
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        nom: user.name || '',
      }));
    }
  }, [user]);

  const fetchCommentaires = async () => {
    try {
      const response = await api.get('/commentaires');
      const commentairesData = response.data.data.commentaires || [];
      // Filtrer pour n'afficher que les commentaires approuvés dans la galerie publique
      const commentairesApprouves = commentairesData.filter(c => c.approuve);
      setCommentaires(commentairesApprouves);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-swipe pour la galerie admin (toutes les 5 secondes)
  useEffect(() => {
    if (galeriePhotos.length === 0 || galeriePhotos.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentGalerieIndex((prev) => (prev + 1) % galeriePhotos.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [galeriePhotos.length]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    const maxPhotos = 5;
    
    if (photos.length + files.length > maxPhotos) {
      alert(`Vous ne pouvez ajouter que ${maxPhotos} photos maximum`);
      return;
    }

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) { // 5MB max
        alert(`La photo ${file.name} est trop grande (max 5MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Exécuter reCAPTCHA avant la soumission
      const recaptchaToken = await executeRecaptcha('comment');

      const dataToSend = {
        texte: formData.texte,
        recaptchaToken,
      };

      // Ajouter la note si elle est sélectionnée
      if (formData.note && formData.note !== '') {
        dataToSend.note = parseInt(formData.note, 10);
      }

      // Si pas connecté, ajouter nom
      if (!user) {
        dataToSend.nom = formData.nom;
      }

      // Ajouter les photos
      if (photos.length > 0) {
        dataToSend.photos = photos;
      }

      await api.post('/commentaires', dataToSend);
      
      // Réinitialiser le formulaire
      setFormData({
        nom: user?.name || '',
        note: '',
        texte: '',
      });
      setPhotos([]);

      alert('Commentaire soumis avec succès ! Il sera publié après approbation.');
      fetchCommentaires();
    } catch (error) {
      console.error('Erreur:', error);
      alert(error.response?.data?.message || 'Erreur lors de l\'ajout du commentaire');
    } finally {
      setSubmitting(false);
    }
  };

  const getAuteurNom = (commentaire) => {
    if (commentaire.user?.name) {
      return commentaire.user.name;
    }
    return commentaire.nom || 'Anonyme';
  };

  return (
    <div className="commentaires-page">
      {/* Header */}
      <div className="commentaires-header">
        <span className="header-label">AVIS CLIENTS</span>
        <h1>Commentaires Snackin</h1>
        <p className="header-description">
          Découvrez nos créations et partagez votre expérience avec la communauté.
        </p>
        <div className="header-divider"></div>
      </div>

      {/* Galerie admin en haut */}
      <div className="galerie-admin-section">
        {loadingGalerie ? (
          <div className="loading-inline">Chargement de la galerie...</div>
        ) : galeriePhotos.length > 0 ? (
          <h2>📸 Notre Galerie</h2>
          <div 
            className="galerie-admin-carousel"
            ref={galerieRef}
            onTouchStart={(e) => onTouchStart(e, 'galerie')}
            onTouchMove={(e) => onTouchMove(e, 'galerie')}
            onTouchEnd={() => onTouchEnd('galerie')}
          >
            <div className="galerie-admin-container">
              {galeriePhotos.map((photo, index) => {
                const isActive = index === currentGalerieIndex;
                return (
                  <div
                    key={photo._id}
                    className={`galerie-admin-item ${isActive ? 'active' : ''}`}
                    style={{
                      transform: `translateX(${(index - currentGalerieIndex) * 100}%)`,
                      zIndex: isActive ? 10 : 1,
                    }}
                  >
                    <img 
                      src={photo.image} 
                      alt={photo.titre || `Photo ${index + 1}`}
                      onLoad={(e) => {
                        // Ajuster dynamiquement la hauteur du conteneur selon l'image
                        const img = e.target;
                        const container = img.closest('.galerie-admin-carousel');
                        if (container && isActive) {
                          const imgHeight = img.offsetHeight;
                          container.style.minHeight = `${Math.max(imgHeight + 100, 400)}px`;
                        }
                      }}
                    />
                    {(photo.titre || photo.description) && (
                      <div className="galerie-admin-caption">
                        {photo.titre && <h3>{photo.titre}</h3>}
                        {photo.description && <p>{photo.description}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {galeriePhotos.length > 1 && (
              <div className="galerie-admin-indicators">
                {galeriePhotos.map((_, index) => (
                  <button
                    key={index}
                    className={`galerie-indicator ${index === currentGalerieIndex ? 'active' : ''}`}
                    onClick={() => setCurrentGalerieIndex(index)}
                    aria-label={`Aller à la photo ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        ) : null}
      </div>

      {/* Commentaires approuvés au milieu avec swipe iOS */}
      <div className="commentaires-section">
        <h2>💬 Commentaires de nos clients</h2>
        {loading ? (
          <div className="loading-inline">Chargement des avis...</div>
        ) : (
        <div 
          className="commentaires-gallery"
          ref={carouselRef}
          onTouchStart={(e) => onTouchStart(e, 'commentaire')}
          onTouchMove={(e) => onTouchMove(e, 'commentaire')}
          onTouchEnd={() => onTouchEnd('commentaire')}
        >
            {commentaires.length === 0 ? (
              <div className="no-commentaires">
                <p>Aucun commentaire pour le moment.</p>
                <span className="flower-icon">🌸</span>
              </div>
            ) : (
              <>
                <div className="gallery-container">
                  {commentaires.map((commentaire, index) => {
                    const note = commentaire.note ? Number(commentaire.note) : null;
                    const isActive = index === currentCommentaireIndex;
                    const currentCommentaire = commentaires[currentCommentaireIndex];
                    
                    return (
                      <div
                        key={commentaire._id}
                        className={`commentaire-card gallery-item ${isActive ? 'active' : ''}`}
                        style={{
                          transform: `translateX(${(index - currentCommentaireIndex) * 100}%)`,
                        }}
                      >
                        <div className="commentaire-header">
                          <div>
                            <strong className="commentaire-auteur">
                              {getAuteurNom(commentaire)}
                            </strong>
                            {commentaire.biscuit && (
                              <span className="commentaire-biscuit">
                                sur {commentaire.biscuit.nom}
                              </span>
                            )}
                          </div>
                          {note && note > 0 && note <= 5 && (
                            <span className="commentaire-note" title={`${note}/5`}>
                              {'⭐'.repeat(note)}
                            </span>
                          )}
                        </div>
                        <p className="commentaire-texte">{commentaire.texte}</p>
                        
                        {/* Galerie photos du commentaire */}
                        {commentaire.photos && commentaire.photos.length > 0 && (
                          <div 
                            className="commentaire-photos"
                            onTouchStart={(e) => onTouchStart(e, 'photo')}
                            onTouchMove={(e) => onTouchMove(e, 'photo')}
                            onTouchEnd={() => onTouchEnd('photo')}
                          >
                            <div className="photos-carousel">
                              {commentaire.photos.map((photo, photoIndex) => (
                                <div
                                  key={photoIndex}
                                  className={`photo-item ${photoIndex === currentPhotoIndex && isActive ? 'active' : ''}`}
                                  style={{
                                    transform: `translateX(${(photoIndex - (isActive ? currentPhotoIndex : 0)) * 100}%)`,
                                  }}
                                >
                                  <img src={photo} alt={`Photo ${photoIndex + 1}`} />
                                </div>
                              ))}
                            </div>
                            {commentaire.photos.length > 1 && (
                              <div className="photo-indicators">
                                {commentaire.photos.map((_, photoIndex) => (
                                  <span
                                    key={photoIndex}
                                    className={`indicator ${photoIndex === currentPhotoIndex && isActive ? 'active' : ''}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Réponse admin */}
                        {commentaire.reponseAdmin && commentaire.reponseAdmin.texte && (
                          <div className="reponse-admin">
                            <div className="reponse-admin-header">
                              <strong>Réponse de Snackin'</strong>
                            </div>
                            <p className="reponse-admin-texte">{commentaire.reponseAdmin.texte}</p>
                            <div className="reponse-admin-date">
                              {new Date(commentaire.reponseAdmin.date).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </div>
                          </div>
                        )}

                        <div className="commentaire-date">
                          {new Date(commentaire.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Indicateurs de pagination */}
                {commentaires.length > 1 && (
                  <div className="gallery-indicators">
                    {commentaires.map((_, index) => (
                      <button
                        key={index}
                        className={`indicator-btn ${index === currentCommentaireIndex ? 'active' : ''}`}
                        onClick={() => setCurrentCommentaireIndex(index)}
                        aria-label={`Aller au commentaire ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
        </div>
        )}
      </div>

      {/* Formulaire en bas */}
      <div className="commentaires-form-section">
        <h2>✍️ Laisser un commentaire</h2>
        <form onSubmit={handleSubmit} className="commentaire-form">
          <div className="form-group">
            <label htmlFor="nom">Votre nom *</label>
            <input
              type="text"
              id="nom"
              name="nom"
              value={formData.nom}
              onChange={handleChange}
              required
              disabled={!!user}
              className="form-input"
              placeholder="Votre nom"
            />
          </div>

          <div className="form-group">
            <label htmlFor="note">Note *</label>
            <div className="stars-input">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  className={`star-btn ${formData.note >= star ? 'active' : ''}`}
                  onClick={() => setFormData({ ...formData, note: star.toString() })}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="texte">Votre commentaire *</label>
            <textarea
              id="texte"
              name="texte"
              value={formData.texte}
              onChange={handleChange}
              required
              rows={6}
              className="form-textarea"
              placeholder="Partagez votre expérience..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="photos">Photos (optionnel, max 5)</label>
            <input
              type="file"
              id="photos"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              className="form-input-file"
            />
            {photos.length > 0 && (
              <div className="photos-preview">
                {photos.map((photo, index) => (
                  <div key={index} className="photo-preview">
                    <img src={photo} alt={`Preview ${index + 1}`} />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="photo-remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !formData.note}
            className="btn-submit"
          >
            {submitting ? 'Publication...' : 'Publier le commentaire'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Commentaires;
