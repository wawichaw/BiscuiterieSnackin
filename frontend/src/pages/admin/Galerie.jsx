import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Galerie.css';

const AdminGalerie = () => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    image: '',
    titre: '',
    description: '',
    ordre: 0,
  });
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const response = await api.get('/galerie');
      setPhotos(response.data.data.photos || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const compressImage = (file, maxWidth = 1200, quality = 0.8) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
      };
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner un fichier image');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert('L\'image est trop grande (max 10MB)');
        return;
      }

      try {
        const compressedImage = await compressImage(file);
        setFormData({ ...formData, image: compressedImage });
        setImagePreview(compressedImage);
      } catch (error) {
        alert('Erreur lors du traitement de l\'image');
        console.error(error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.image) {
      alert('Veuillez sélectionner une image');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/galerie', formData);
      setFormData({ image: '', titre: '', description: '', ordre: 0 });
      setImagePreview('');
      fetchPhotos();
      alert('Photo ajoutée à la galerie avec succès !');
    } catch (error) {
      console.error('Erreur:', error);
      alert(error.response?.data?.message || 'Erreur lors de l\'ajout de la photo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette photo ?')) {
      return;
    }
    try {
      await api.delete(`/galerie/${id}`);
      fetchPhotos();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="admin-galerie-page">
      <h1>📸 Gérer la Galerie</h1>

      <div className="galerie-admin-content">
        <div className="galerie-form-panel">
          <h2>Ajouter une photo</h2>
          <form onSubmit={handleSubmit} className="galerie-form">
            <div className="form-group">
              <label>Image *</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="file-input"
              />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Aperçu" />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Titre (optionnel)</label>
              <input
                type="text"
                value={formData.titre}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                className="form-input"
                placeholder="Titre de la photo"
              />
            </div>

            <div className="form-group">
              <label>Description (optionnel)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-textarea"
                rows="3"
                placeholder="Description de la photo"
              />
            </div>

            <div className="form-group">
              <label>Ordre d'affichage</label>
              <input
                type="number"
                value={formData.ordre}
                onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
                className="form-input"
                min="0"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !formData.image}
              className="btn-submit"
            >
              {submitting ? 'Ajout...' : 'Ajouter à la galerie'}
            </button>
          </form>
        </div>

        <div className="galerie-list-panel">
          <h2>Photos de la galerie ({photos.length})</h2>
          {photos.length === 0 ? (
            <div className="no-photos">
              <p>Aucune photo dans la galerie.</p>
            </div>
          ) : (
            <div className="galerie-photos-grid">
              {photos.map((photo) => (
                <div key={photo._id} className="galerie-photo-item">
                  <img src={photo.image} alt={photo.titre || 'Photo'} />
                  <div className="photo-info">
                    {photo.titre && <h3>{photo.titre}</h3>}
                    {photo.description && <p>{photo.description}</p>}
                    <div className="photo-meta">
                      <span>Ordre: {photo.ordre}</span>
                      <span className={photo.actif ? 'actif' : 'inactif'}>
                        {photo.actif ? '✓ Actif' : '✗ Inactif'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(photo._id)}
                    className="btn-delete"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminGalerie;
