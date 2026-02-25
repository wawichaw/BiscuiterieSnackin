import React from 'react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Tableau de bord administrateur</h1>
        <p className="dashboard-subtitle">Gérez votre boutique Snackin'</p>
      </div>

      <div className="dashboard-grid">
        <Link to="/admin/biscuits" className="dashboard-card">
          <div className="card-icon">🍪</div>
          <h3>Gérer les biscuits</h3>
          <p>Ajouter, modifier ou supprimer des biscuits</p>
        </Link>

        <Link to="/admin/commandes" className="dashboard-card">
          <div className="card-icon">📦</div>
          <h3>Gérer les commandes</h3>
          <p>Voir et gérer toutes les commandes</p>
        </Link>

        <Link to="/admin/commentaires" className="dashboard-card">
          <div className="card-icon">💬</div>
          <h3>Gérer les commentaires</h3>
          <p>Modérer les commentaires clients</p>
        </Link>

        <Link to="/admin/galerie" className="dashboard-card">
          <div className="card-icon">📸</div>
          <h3>Gérer la galerie</h3>
          <p>Ajouter des photos à la galerie</p>
        </Link>

        <Link to="/admin/tarifs" className="dashboard-card">
          <div className="card-icon">💰</div>
          <h3>Prix des boîtes</h3>
          <p>Modifier les prix des boîtes 4, 6 et 12 biscuits</p>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;

