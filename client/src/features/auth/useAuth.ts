import { useGetMeQuery } from './authApi';
import type { User } from '../../types/models';

export interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  isFetching: boolean;
  isAuthenticated: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const { data, isLoading, isFetching, isError, error, refetch } = useGetMeQuery();
  const user = data ?? null;
  const isAuthenticated = Boolean(
    user && user.isActive && (user.accountStatus === undefined || user.accountStatus === 'active')
  );

  return {
    user,
    isLoading,
    isFetching,
    isAuthenticated,
    isError,
    error,
    refetch,
  };
};

export default useAuth;
