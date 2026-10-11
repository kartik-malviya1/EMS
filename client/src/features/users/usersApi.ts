import { apiSlice } from '../api/apiSlice';
import type {
  User,
  ApiResponse,
  PaginationMeta,
  Role,
} from '../../types/models';

export interface UserQueryParams {
  role?: Role | '';
  search?: string;
  isActive?: boolean | string;
  accountStatus?: string;
  managerId?: string;
  page?: number;
  limit?: number;
}

export interface UsersListResult {
  data: User[];
  meta?: PaginationMeta;
}

export interface UpdateUserPayload {
  id: string;
  name?: string;
  role?: Role;
  employeeId?: string;
  department?: string;
  designation?: string;
  accountStatus?: 'invited' | 'active' | 'suspended' | 'deactivated';
  managerId?: string | null;
  isActive?: boolean;
}

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<UsersListResult, UserQueryParams | void>({
      query: (params) => ({
        url: '/users',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<User[]>) => ({
        data: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id, _id }) => ({
                type: 'User' as const,
                id: id || _id,
              })),
              'User',
            ]
          : ['User'],
    }),

    getTeamUsers: builder.query<User[], { status?: string } | void>({
      query: (params) => ({
        url: '/users/team',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<User[]>) => response.data,
      providesTags: ['User'],
    }),

    getManagers: builder.query<User[], void>({
      query: () => '/users/managers',
      transformResponse: (response: ApiResponse<User[]>) => response.data,
      providesTags: ['User'],
    }),

    getUserById: builder.query<User, string>({
      query: (id) => `/users/${id}`,
      transformResponse: (response: ApiResponse<User>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'User', id }],
    }),

    updateUser: builder.mutation<User, UpdateUserPayload>({
      query: ({ id, ...body }) => ({
        url: `/users/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: ApiResponse<User>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        'User',
        'Dashboard',
        { type: 'User', id },
      ],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetTeamUsersQuery,
  useGetManagersQuery,
  useGetUserByIdQuery,
  useUpdateUserMutation,
} = usersApi;
