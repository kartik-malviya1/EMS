import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import { getRoleDefaultPath } from './roleUtils';

export const RoleRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        data-testid="role-redirect-loading"
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

  const targetPath = getRoleDefaultPath(user?.role);
  return <Navigate to={targetPath} replace />;
};

export default RoleRedirect;
