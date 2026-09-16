import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children, allowAssistant = false }) => {
  const { user, isAdmin, isAssistant, loading } = useAuth();

  if (loading) {
    return <div>Chargement...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowed = isAdmin || (allowAssistant && isAssistant);
  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
