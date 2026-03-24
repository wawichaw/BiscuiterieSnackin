import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import logoImage from '../../assets/logo.png';
import './BarreNavigation.css';

const Layout = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const timeoutRef = React.useRef(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowDropdown(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
    }, 200); // Délai de 200ms avant de fermer
  };

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // Nettoyer le timeout au démontage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Fermer le menu mobile quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileMenuOpen && !event.target.closest('.snk-nav')) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Fermer le menu mobile quand on change de route
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="vue-shell">
      <nav className="snk-nav">
        <div className="snk-container">
          <Link className="snk-logo" to="/" onClick={closeMobileMenu}>
            <img
              src={logoImage}
              alt="Snackin logo"
              style={{ width: '36px', height: '36px', objectFit: 'contain' }}
            />
            <strong>Snackin'</strong>
          </Link>
          <span className="snk-badge">Fait avec amour</span>

          {/* Menu Desktop */}
          <div className="snk-spacer"></div>
          <div className="nav-links-desktop">
            <Link to="/">Accueil</Link>
            <Link to="/biscuits">Biscuits</Link>
            {!isAdmin && <Link to="/commander">Commander</Link>}
            {user && !isAdmin && <Link to="/mes-commandes">Mes commandes</Link>}
            <Link to="/commentaires">Commentaires</Link>
            <Link to="/about">À propos</Link>
          </div>

          <div className="snk-spacer"></div>
          <div className="nav-auth-desktop">
            {!user ? (
              <>
                <Link to="/login">Se connecter</Link>
                <Link to="/register">S'inscrire</Link>
              </>
            ) : (
              <>
                <div
                  className="user-menu"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <Link
                    to={isAdmin ? '/admin/dashboard' : '#'}
                    className="user-name"
                  >
                    {user.name}
                  </Link>
                  {showDropdown && (
                    <div
                      className="user-dropdown"
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                    >
                      {isAdmin && (
                        <>
                          <Link to="/admin/dashboard" onClick={() => setShowDropdown(false)}>
                            Tableau de bord
                          </Link>
                          <Link to="/admin/biscuits" onClick={() => setShowDropdown(false)}>
                            Biscuits
                          </Link>
                          <Link to="/admin/commandes" onClick={() => setShowDropdown(false)}>
                            Commandes
                          </Link>
                        <Link to="/admin/horaires" onClick={() => setShowDropdown(false)}>
                          Horaires de ramassage
                        </Link>
                        <Link to="/admin/commentaires" onClick={() => setShowDropdown(false)}>
                          Commentaires
                        </Link>
                        <Link to="/admin/galerie" onClick={() => setShowDropdown(false)}>
                          Galerie photos
                        </Link>
                        </>
                      )}
                      {!isAdmin && (
                        <Link to="/mes-commandes" onClick={() => setShowDropdown(false)}>
                          Mes commandes
                        </Link>
                      )}
                      <button type="button" onClick={handleLogout} className="logout-btn">
                        Se déconnecter
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-logout-nav"
                  title="Se déconnecter"
                >
                  🚪 Déconnexion
                </button>
              </>
            )}
          </div>

          {/* Bouton Hamburger Mobile */}
          <button 
            className="hamburger-btn"
            onClick={toggleMobileMenu}
            aria-label="Menu"
          >
            <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
          </button>
        </div>

        {/* Menu Mobile */}
        <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <Link to="/" onClick={closeMobileMenu}>Accueil</Link>
          <Link to="/biscuits" onClick={closeMobileMenu}>Biscuits</Link>
          {!isAdmin && (
            <Link to="/commander" onClick={closeMobileMenu}>Commander</Link>
          )}
          {user && !isAdmin && (
            <Link to="/mes-commandes" onClick={closeMobileMenu}>Mes commandes</Link>
          )}
          <Link to="/commentaires" onClick={closeMobileMenu}>Commentaires</Link>
          <Link to="/about" onClick={closeMobileMenu}>À propos</Link>
          
          <div className="mobile-menu-divider"></div>
          
          {!user ? (
            <>
              <Link to="/login" onClick={closeMobileMenu}>Se connecter</Link>
              <Link to="/register" onClick={closeMobileMenu}>S'inscrire</Link>
            </>
          ) : (
            <>
              <div className="mobile-user-info">
                <span className="mobile-user-name">{user.name}</span>
                {isAdmin && (
                  <Link to="/admin/dashboard" onClick={closeMobileMenu} className="mobile-admin-link">
                    Tableau de bord
                  </Link>
                )}
              </div>
              <button type="button" onClick={handleLogout} className="mobile-logout-btn">
                Se déconnecter
              </button>
            </>
          )}
        </div>
      </nav>

      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;

