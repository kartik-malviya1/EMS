import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import { getRoleDefaultPath } from './roleUtils';

export const RoleRedirect: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);

  const targetPath = getRoleDefaultPath(user?.role);
  return <Navigate to={targetPath} replace />;
};

export default RoleRedirect;
