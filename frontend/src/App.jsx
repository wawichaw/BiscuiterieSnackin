import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import api from './services/api';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/BarreNavigation/BarreNavigation';
import Home from './pages/Home';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Biscuits = lazy(() => import('./pages/Biscuits'));
const BiscuitDetail = lazy(() => import('./pages/BiscuitDetail'));
const Commander = lazy(() => import('./pages/Commander'));
const MesCommandes = lazy(() => import('./pages/MesCommandes'));
const Commentaires = lazy(() => import('./pages/Commentaires'));
const About = lazy(() => import('./pages/About'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminBiscuits = lazy(() => import('./pages/admin/Biscuits'));
const AdminCommandes = lazy(() => import('./pages/admin/Commandes'));
const AdminCommentaires = lazy(() => import('./pages/admin/Commentaires'));
const AdminHoraires = lazy(() => import('./pages/admin/Horaires'));
const AdminGalerie = lazy(() => import('./pages/admin/Galerie'));
const AdminTarifs = lazy(() => import('./pages/admin/Tarifs'));

function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      Chargement…
    </div>
  );
}

function App() {
  useEffect(() => {
    const path = window.location.pathname;
    const shouldPrefetch = path === '/commander';
    if (!shouldPrefetch) return undefined;

    const prefetch = async () => {
      try {
        const [biscuitsRes, tarifsRes, commentairesRes, galerieRes] = await Promise.allSettled([
          api.get('/biscuits?light=1'),
          api.get('/tarifs/boites'),
          api.get('/commentaires'),
          api.get('/galerie'),
        ]);

        if (biscuitsRes.status === 'fulfilled') {
          const list = biscuitsRes.value.data?.data?.biscuits;
          if (Array.isArray(list)) {
            localStorage.setItem('snackin_biscuits', JSON.stringify({ data: list, at: Date.now() }));
          }
        }
        if (tarifsRes.status === 'fulfilled') {
          const prix = tarifsRes.value.data?.data?.prixBoites;
          if (prix) {
            localStorage.setItem('snackin_tarifs_boites', JSON.stringify({ data: prix, at: Date.now() }));
          }
        }
        if (commentairesRes.status === 'fulfilled') {
          const commentaires = commentairesRes.value.data?.data?.commentaires;
          if (Array.isArray(commentaires)) {
            localStorage.setItem('snackin_commentaires', JSON.stringify({ data: commentaires, at: Date.now() }));
          }
        }
        if (galerieRes.status === 'fulfilled') {
          const photos = galerieRes.value.data?.data?.photos;
          if (Array.isArray(photos)) {
            localStorage.setItem('snackin_galerie', JSON.stringify({ data: photos, at: Date.now() }));
          }
        }
      } catch (_) {
        // Prefetch best effort: ignorer silencieusement les erreurs.
      }
    };

    // Laisse le rendu initial respirer avant de précharger.
    let idleId;
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => prefetch(), { timeout: 1500 });
    } else {
      idleId = window.setTimeout(() => prefetch(), 500);
    }

    return () => {
      if ('cancelIdleCallback' in window && typeof idleId === 'number') {
        window.cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId);
      }
    };
  }, []);

  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/biscuits" element={<Biscuits />} />
            <Route path="/biscuits/:id" element={<BiscuitDetail />} />
            <Route path="/commentaires" element={<Commentaires />} />
            <Route path="/about" element={<About />} />

            {/* Public route - Commander accessible sans connexion */}
            <Route path="/commander" element={<Commander />} />

            {/* Protected routes */}
            <Route
              path="/mes-commandes"
              element={
                <PrivateRoute>
                  <MesCommandes />
                </PrivateRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/biscuits"
              element={
                <AdminRoute>
                  <AdminBiscuits />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/commandes"
              element={
                <AdminRoute>
                  <AdminCommandes />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/commentaires"
              element={
                <AdminRoute>
                  <AdminCommentaires />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/horaires"
              element={
                <AdminRoute>
                  <AdminHoraires />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/galerie"
              element={
                <AdminRoute>
                  <AdminGalerie />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tarifs"
              element={
                <AdminRoute>
                  <AdminTarifs />
                </AdminRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;

