import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useGetMeQuery } from '../features/auth/authApi';
import { setCredentials, logoutUser, setInitialized } from '../features/auth/authSlice';
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
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isInitialized } = useAppSelector(
    (state) => state.auth
  );

  const { data: meData, isLoading, isError, isSuccess } = useGetMeQuery(undefined, {
    // Only skip if already initialized and authenticated
    skip: isInitialized && isAuthenticated,
  });

  useEffect(() => {
    if (isSuccess && meData) {
      dispatch(setCredentials({ user: meData }));
    } else if (isError) {
      dispatch(logoutUser());
    } else if (!isLoading && !meData && !isAuthenticated) {
      dispatch(setInitialized(true));
    }
  }, [isSuccess, isError, isLoading, meData, isAuthenticated, dispatch]);

  // Loading state while restoring session from /auth/me
  if (!isInitialized && isLoading) {
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

  // Unauthenticated -> redirect to /login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Account inactive check
  if (!user.isActive) {
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
