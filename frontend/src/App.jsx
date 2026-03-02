import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/BarreNavigation/BarreNavigation';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Biscuits from './pages/Biscuits';
import BiscuitDetail from './pages/BiscuitDetail';
import Commander from './pages/Commander';
import MesCommandes from './pages/MesCommandes';
import Commentaires from './pages/Commentaires';
import About from './pages/About';
import AdminDashboard from './pages/admin/Dashboard';
import AdminBiscuits from './pages/admin/Biscuits';
import AdminCommandes from './pages/admin/Commandes';
import AdminCommentaires from './pages/admin/Commentaires';
import AdminHoraires from './pages/admin/Horaires';
import AdminGalerie from './pages/admin/Galerie';
import AdminTarifs from './pages/admin/Tarifs';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout>
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
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;

