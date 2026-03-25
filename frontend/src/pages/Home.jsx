import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import cookieOreo from '../assets/cookie_oreo.png';
import './Home.css';

const AdminDashboard = lazy(() => import('./admin/Dashboard'));

const Home = () => {
  const { user, isAdmin } = useAuth();
  const [showHeroImage, setShowHeroImage] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > 768;
  });

  useEffect(() => {
    const onResize = () => setShowHeroImage(window.innerWidth > 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Si admin connecté, afficher le dashboard (chunk séparé pour ne pas alourdir l’accueil public)
  if (user && isAdmin) {
    return (
      <Suspense
        fallback={
          <div className="route-fallback" role="status" aria-live="polite">
            Chargement…
          </div>
        }
      >
        <AdminDashboard />
      </Suspense>
    );
  }

  return (
    <div className="landing-page">
      <section className="hero">
        <div className="hero-inner">
          <div>
            <div className="kickers">
              <span>🍪 Frais du jour</span>
              <span>🧁 Fait maison</span>
              <span>🌸 Innoublieable</span>
            </div>
            <h1>
              Croquants dehors, fondants dedans.<br />
              Les biscuits qui rendent tout le monde heureux.
            </h1>
            <p className="hero-subtitle desktop-only">Gérez vos biscuits, découvrez les saveurs et passez vos commandes en 2 clics.</p>
            <p className="hero-subtitle mobile-only">Commandez en 2 clics.</p>

            <div className="cta-row">
              {!isAdmin && (
                <Link to="/commander" className="btn primary">
                  Commander
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin/commandes" className="btn primary">
                  Gérer les commandes
                </Link>
              )}
              <Link to="/biscuits" className="btn primary">
                Découvrez notre sélection
              </Link>
            </div>
          </div>

          {showHeroImage && (
            <div className="hero-card">
              <div className="hero-visual">
                <img
                  src={cookieOreo}
                  alt="Cookie Oreo"
                  loading="eager"
                  decoding="async"
                  fetchpriority="high"
                />
              </div>
              <span className="sticker">Best-seller ✨</span>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="grid">
          {!isAdmin && (
            <div className="card">
              <h3>Commander</h3>
              <p className="desktop-only">
                Choisis la taille (4, 6, 12) et compose ta boîte.<br />
                Tu récupères au point de ramassage.
              </p>
              <p className="mobile-only">Boîtes 4, 6 ou 12 — récupère au point de ramassage.</p>
              <p>
                <Link to="/commander" className="btn primary">
                  Je commande
                </Link>
              </p>
            </div>
          )}
          {isAdmin && (
            <div className="card">
              <h3>Gérer les commandes</h3>
              <p className="desktop-only">Consultez, modifiez et suivez toutes les commandes de vos clients.</p>
              <p className="mobile-only">Voir et gérer les commandes.</p>
              <p>
                <Link to="/admin/commandes" className="btn primary">
                  Gérer les commandes
                </Link>
              </p>
            </div>
          )}
          <div className="card">
            <h3>Menu</h3>
            <p className="desktop-only">Découvrez notre sélection de biscuits faits maison</p>
            <p className="mobile-only">Biscuits faits maison</p>
            <p>
              <Link to="/biscuits" className="btn">
                Voir les biscuits
              </Link>
            </p>
          </div>
          <div className="card">
            <h3>Avis</h3>
            <p className="desktop-only">Découvrez ce que pensent nos clients et partagez votre expérience.</p>
            <p className="mobile-only">Lisez et laissez un avis.</p>
            <p>
              <Link to="/commentaires" className="btn outline">
                Voir les commentaires
              </Link>
            </p>
          </div>
        </div>
      </section>

      <footer>
        <small>© {new Date().getFullYear()} Snackin — Fait avec amour</small>
      </footer>
    </div>
  );
};

export default Home;

