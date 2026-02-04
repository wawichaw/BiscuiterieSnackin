import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Commentaires.css';

const AdminCommentaires = () => {
  const [commentaires, setCommentaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reponseText, setReponseText] = useState({});
  const [showReponseForm, setShowReponseForm] = useState({});

  useEffect(() => {
    fetchCommentaires();
  }, []);

  const fetchCommentaires = async () => {
    try {
      const response = await api.get('/commentaires');
      setCommentaires(response.data.data.commentaires);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/commentaires/${id}/approve`);
      fetchCommentaires();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de l\'approbation');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) {
      return;
    }
    try {
      await api.delete(`/commentaires/${id}`);
      fetchCommentaires();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleReponseSubmit = async (id) => {
    if (!reponseText[id] || reponseText[id].trim() === '') {
      alert('Veuillez entrer une réponse');
      return;
    }
    try {
      await api.put(`/commentaires/${id}/reponse`, {
        texte: reponseText[id],
      });
      setReponseText({ ...reponseText, [id]: '' });
      setShowReponseForm({ ...showReponseForm, [id]: false });
      fetchCommentaires();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de l\'ajout de la réponse');
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="admin-commentaires-page">
      <h1>💬 Gérer les commentaires</h1>
      <div className="commentaires-list">
        {commentaires.map((commentaire) => {
          const note = commentaire.note ? Number(commentaire.note) : null;
          return (
            <div key={commentaire._id} className="commentaire-item">
              <div className="commentaire-content">
                <div className="commentaire-header-admin">
                  <div>
                    <strong>{commentaire.user?.name || commentaire.nom || 'Anonyme'}</strong>
                    {note && (
                      <span className="commentaire-note-admin">
                        {'⭐'.repeat(note)}
                      </span>
                    )}
                    <span className={`statut-badge ${commentaire.approuve ? 'approuve' : 'en-attente'}`}>
                      {commentaire.approuve ? '✓ Approuvé' : '⏳ En attente'}
                    </span>
                  </div>
                  <div className="commentaire-date-admin">
                    {new Date(commentaire.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <p className="commentaire-texte-admin">{commentaire.texte}</p>
                
                {/* Photos */}
                {commentaire.photos && commentaire.photos.length > 0 && (
                  <div className="commentaire-photos-admin">
                    {commentaire.photos.map((photo, index) => (
                      <img key={index} src={photo} alt={`Photo ${index + 1}`} />
                    ))}
                  </div>
                )}

                {/* Réponse admin existante */}
                {commentaire.reponseAdmin && commentaire.reponseAdmin.texte && (
                  <div className="reponse-admin-existing">
                    <strong>Réponse:</strong>
                    <p>{commentaire.reponseAdmin.texte}</p>
                  </div>
                )}

                {/* Formulaire de réponse */}
                {showReponseForm[commentaire._id] ? (
                  <div className="reponse-form">
                    <textarea
                      value={reponseText[commentaire._id] || ''}
                      onChange={(e) => setReponseText({ ...reponseText, [commentaire._id]: e.target.value })}
                      placeholder="Votre réponse..."
                      rows="3"
                      className="reponse-textarea"
                    />
                    <div className="reponse-actions">
                      <button
                        onClick={() => handleReponseSubmit(commentaire._id)}
                        className="btn primary"
                      >
                        Envoyer
                      </button>
                      <button
                        onClick={() => {
                          setShowReponseForm({ ...showReponseForm, [commentaire._id]: false });
                          setReponseText({ ...reponseText, [commentaire._id]: '' });
                        }}
                        className="btn secondary"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="commentaire-actions">
                    {!commentaire.approuve && (
                      <button
                        onClick={() => handleApprove(commentaire._id)}
                        className="btn primary"
                      >
                        ✓ Approuver
                      </button>
                    )}
                    {!commentaire.reponseAdmin && (
                      <button
                        onClick={() => setShowReponseForm({ ...showReponseForm, [commentaire._id]: true })}
                        className="btn secondary"
                      >
                        💬 Répondre
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(commentaire._id)}
                      className="btn danger"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminCommentaires;

