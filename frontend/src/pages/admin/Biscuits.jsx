import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Biscuits.css';

const AdminBiscuits = () => {
  const [biscuits, setBiscuits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBiscuit, setEditingBiscuit] = useState(null);
  const formRef = React.useRef(null);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    prix: '',
    saveur: '',
    disponible: true,
    stock: 0,
    image: ''
  });
  const [imagePreview, setImagePreview] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [restockValues, setRestockValues] = useState({});
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchBiscuits();
  }, []);

  const fetchBiscuits = async () => {
    try {
      // Pour l'admin, on récupère tous les biscuits (disponibles et indisponibles)
      const response = await api.get('/biscuits');
      // Si l'API ne retourne que les disponibles, on peut créer une route admin séparée
      // Pour l'instant, on utilise la route publique qui filtre par disponible: true
      setBiscuits(response.data.data.biscuits || []);
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur lors du chargement des biscuits');
    } finally {
      setLoading(false);
    }
  };

  const compressImage = (file, maxWidth = 800, quality = 0.7) => {
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

          // Redimensionner si nécessaire
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convertir en base64 avec compression
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
      };
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Vérifier le type de fichier
      if (!file.type.startsWith('image/')) {
        setError('Veuillez sélectionner un fichier image');
        return;
      }

      // Vérifier la taille (max 10MB avant compression)
      if (file.size > 10 * 1024 * 1024) {
        setError('L\'image est trop grande (max 10MB)');
        return;
      }

      try {
        // Compresser l'image
        const compressedImage = await compressImage(file);
        setFormData({ ...formData, image: compressedImage });
        setImagePreview(compressedImage);
        setError('');
      } catch (error) {
        setError('Erreur lors du traitement de l\'image');
        console.error(error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const payload = {
        ...formData,
        prix: parseFloat(formData.prix),
        stock: parseInt(formData.stock) || 0,
      };

      if (editingBiscuit) {
        await api.put(`/biscuits/${editingBiscuit._id}`, payload);
        setSuccess('Biscuit modifié avec succès !');
      } else {
        await api.post('/biscuits', payload);
        setSuccess('Biscuit créé avec succès !');
      }

      setFormData({
        nom: '',
        description: '',
        prix: '',
        saveur: '',
        disponible: true,
        stock: 0,
        image: ''
      });
      setImagePreview('');
      setShowForm(false);
      setEditingBiscuit(null);
      fetchBiscuits(); // Rafraîchir la liste
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de l\'enregistrement du biscuit');
    }
  };

  const handleStockUpdate = async (id, payload, successMessage) => {
    setUpdatingId(id);
    setError('');
    setSuccess('');
    try {
      const response = await api.patch(`/biscuits/${id}/stock`, payload);
      setSuccess(successMessage);
      setRestockValues((prev) => ({ ...prev, [id]: '' }));
      setBiscuits((prev) => prev.map((b) => (
        b._id === id ? response.data.data.biscuit : b
      )));
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour du stock');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleDisponible = async (biscuit) => {
    setUpdatingId(biscuit._id);
    setError('');
    setSuccess('');
    try {
      const response = await api.patch(`/biscuits/${biscuit._id}/disponible`, {
        disponible: !biscuit.disponible,
      });
      setSuccess(response.data.message || 'Statut mis à jour');
      setBiscuits((prev) => prev.map((b) => (
        b._id === biscuit._id ? response.data.data.biscuit : b
      )));
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du changement de statut');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStockClass = (stock) => {
    if (stock <= 0) return 'stock-empty';
    if (stock <= 10) return 'stock-low';
    return 'stock-ok';
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce biscuit ?')) {
      return;
    }

    try {
      await api.delete(`/biscuits/${id}`);
      setSuccess('Biscuit supprimé avec succès !');
      fetchBiscuits();
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="admin-biscuits-page">
      <div className="admin-header">
        <h1>🍪 Gérer les biscuits</h1>
        <button 
          className="btn btn-primary" 
          onClick={() => {
            if (showForm && editingBiscuit) {
              // Fermer le formulaire d'édition
              setEditingBiscuit(null);
              setFormData({
                nom: '',
                description: '',
                prix: '',
                saveur: '',
                disponible: true,
                stock: 0,
                image: ''
              });
              setImagePreview('');
              setShowForm(false);
            } else {
              // Basculer l'affichage du formulaire (création)
              setEditingBiscuit(null);
              setShowForm(!showForm);
            }
          }}
        >
          {showForm ? 'Annuler' : '+ Ajouter un biscuit'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <form ref={formRef} className="biscuit-form" onSubmit={handleSubmit}>
          <h2>{editingBiscuit ? 'Modifier le biscuit' : 'Nouveau biscuit'}</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Nom *</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Prix ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.prix}
                onChange={(e) => setFormData({ ...formData, prix: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Saveur</label>
              <input
                type="text"
                value={formData.saveur}
                onChange={(e) => setFormData({ ...formData, saveur: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Stock</label>
              <input
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="file-input"
            />
            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Aperçu" loading="lazy" decoding="async" />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview('');
                    setFormData({ ...formData, image: '' });
                  }}
                  className="btn-remove-image"
                >
                  ✕ Supprimer l'image
                </button>
              </div>
            )}
            <small className="form-help">
              Vous pouvez aussi entrer une URL d'image :
            </small>
            <input
              type="text"
              value={formData.image && !formData.image.startsWith('data:') ? formData.image : ''}
              onChange={(e) => {
                setFormData({ ...formData, image: e.target.value });
                setImagePreview(e.target.value);
              }}
              placeholder="https://example.com/image.jpg"
              className="image-url-input"
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.disponible}
                onChange={(e) => setFormData({ ...formData, disponible: e.target.checked })}
              />
              Disponible
            </label>
          </div>

          <button type="submit" className="btn btn-primary">
            {editingBiscuit ? 'Enregistrer les modifications' : 'Créer le biscuit'}
          </button>
        </form>
      )}

      <div className="biscuits-list">
        {biscuits.length === 0 ? (
          <p>Aucun biscuit disponible</p>
        ) : (
          biscuits.map((biscuit) => (
            <div
              key={biscuit._id}
              className={`biscuit-item ${!biscuit.disponible || biscuit.stock <= 0 ? 'biscuit-item-indisponible' : ''}`}
            >
              <div className="biscuit-info">
                <h3>{biscuit.nom}</h3>
                {biscuit.description && <p className="biscuit-description">{biscuit.description}</p>}
                <p className="biscuit-price">{biscuit.prix} $</p>
                {biscuit.saveur && <p className="biscuit-saveur">Saveur: {biscuit.saveur}</p>}
                <p className={`biscuit-stock ${getStockClass(biscuit.stock || 0)}`}>
                  Stock : <strong>{biscuit.stock || 0}</strong>
                  {biscuit.stock <= 0 && ' — Rupture de stock'}
                  {biscuit.stock > 0 && biscuit.stock <= 10 && ' — Stock bas'}
                </p>
                <p className={`biscuit-status ${biscuit.disponible && biscuit.stock > 0 ? 'available' : 'unavailable'}`}>
                  {biscuit.disponible && biscuit.stock > 0 ? '✓ En vente' : '✗ Indisponible'}
                </p>
              </div>

              <div className="biscuit-stock-panel">
                <h4>Gestion du stock</h4>
                <div className="stock-quick-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={updatingId === biscuit._id}
                    onClick={() => handleStockUpdate(biscuit._id, { ajout: 10 }, `+10 ajoutés au stock de ${biscuit.nom}`)}
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={updatingId === biscuit._id}
                    onClick={() => handleStockUpdate(biscuit._id, { ajout: 30 }, `+30 ajoutés au stock de ${biscuit.nom}`)}
                  >
                    +30
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={updatingId === biscuit._id}
                    onClick={() => handleStockUpdate(biscuit._id, { stock: 0 }, `${biscuit.nom} marqué en rupture de stock`)}
                  >
                    Rupture (0)
                  </button>
                </div>
                <div className="stock-restock-row">
                  <input
                    type="number"
                    min="1"
                    placeholder="Quantité à ajouter"
                    value={restockValues[biscuit._id] ?? ''}
                    onChange={(e) => setRestockValues((prev) => ({
                      ...prev,
                      [biscuit._id]: e.target.value,
                    }))}
                    className="stock-restock-input"
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={updatingId === biscuit._id || !restockValues[biscuit._id]}
                    onClick={() => {
                      const ajout = parseInt(restockValues[biscuit._id], 10);
                      if (!ajout || ajout <= 0) return;
                      handleStockUpdate(
                        biscuit._id,
                        { ajout },
                        `+${ajout} ajoutés au stock de ${biscuit.nom}`,
                      );
                    }}
                  >
                    Restock
                  </button>
                </div>
              </div>

              <div className="biscuit-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={updatingId === biscuit._id || (biscuit.stock <= 0 && !biscuit.disponible)}
                  onClick={() => handleToggleDisponible(biscuit)}
                >
                  {biscuit.disponible && biscuit.stock > 0 ? 'Retirer de la vente' : 'Remettre en vente'}
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => {
                    setEditingBiscuit(biscuit);
                    setFormData({
                      nom: biscuit.nom || '',
                      description: biscuit.description || '',
                      prix: biscuit.prix != null ? biscuit.prix.toString() : '',
                      saveur: biscuit.saveur || '',
                      disponible: biscuit.disponible ?? true,
                      stock: biscuit.stock != null ? biscuit.stock.toString() : '0',
                      image: biscuit.image || ''
                    });
                    setImagePreview(biscuit.image || '');
                    setError('');
                    setSuccess('');
                    setShowForm(true);
                    // Faire défiler vers le formulaire après ouverture (React met à jour le DOM après)
                    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }}
                >
                  Modifier
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => handleDelete(biscuit._id)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminBiscuits;

