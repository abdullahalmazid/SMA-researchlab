import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

interface Props {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
  requireAdminAccess?: boolean;
}

const ProtectedRoute: React.FC<Props> = ({
  children,
  allowedRoles,
  redirectTo = '/login',
  requireAdminAccess = false,
}) => {
  const { role, loading, appUser } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const hasAdminAccess = appUser?.adminLevel === "primary" || appUser?.adminLevel === "moderator" || role === "admin";
  if (!role || (requireAdminAccess ? !hasAdminAccess : !allowedRoles.includes(role))) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
