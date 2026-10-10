import type { Role } from '../types/models';

export const getRoleDefaultPath = (role?: Role): string => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'manager':
      return '/manager';
    case 'employee':
    default:
      return '/employee';
  }
};
