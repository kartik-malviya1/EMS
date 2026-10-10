import { apiSlice } from '../api/apiSlice';
import type { GeofenceSettings, ApiResponse } from '../../types/models';

export const settingsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getGeofenceSettings: builder.query<GeofenceSettings, void>({
      query: () => '/settings/geofence',
      transformResponse: (response: ApiResponse<GeofenceSettings>) =>
        response.data,
      providesTags: ['Settings'],
    }),

    updateGeofenceSettings: builder.mutation<
      GeofenceSettings,
      GeofenceSettings
    >({
      query: (body) => ({
        url: '/settings/geofence',
        method: 'PUT',
        body,
      }),
      transformResponse: (response: ApiResponse<GeofenceSettings>) =>
        response.data,
      invalidatesTags: ['Settings'],
    }),
  }),
});

export const {
  useGetGeofenceSettingsQuery,
  useUpdateGeofenceSettingsMutation,
} = settingsApi;
