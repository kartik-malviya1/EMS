import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import { AppShell } from '../components/layout/AppShell';
import type { Role } from '../types/models';
import { getRoleDefaultPath } from './roleUtils';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
  withShell?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  withShell = true,
}) => {
  const location = useLocation();
  const { user, isLoading, isAuthenticated, isError } = useAuth();

  // Full-page loading state while /auth/me is loading - NEVER redirect during loading
  if (isLoading) {
    return (
      <div
        data-testid="protected-loading"
        className="min-h-screen flex items-center justify-center bg-background text-foreground"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">
            Authenticating session...
          </p>
        </div>
      </div>
    );
  }

  // Redirect to /login only after /auth/me finishes with 401 / error / unauthenticated
  // Preserve the original location in router state so login returns the user to it.
  if (isError || !isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role authorization
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const defaultPath = getRoleDefaultPath(user.role);
    return <Navigate to={defaultPath} replace />;
  }

  return withShell ? <AppShell>{children}</AppShell> : <>{children}</>;
};

export default ProtectedRoute;
