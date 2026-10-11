import { apiSlice } from "../api/apiSlice";
import type { Invitation, User, Role } from "../../types/models";

export interface InvitationsQuery {
  status?: string;
  role?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface InvitationsResponse {
  data: Invitation[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateInvitationRequest {
  name: string;
  email: string;
  role: Role;
  employeeId?: string;
  department?: string;
  designation?: string;
  managerId?: string | null;
}

export interface EmailStatusResponse {
  mode: "development" | "resend";
  provider: "resend";
  configured: boolean;
  senderAddress: string;
  senderDomain: string;
  sandboxSender: boolean;
}

export interface CreateInvitationResponse {
  invitation: Invitation;
  user?: Partial<User>;
  email: {
    mode: "development" | "resend";
    status: "pending" | "accepted" | "failed" | "dev_link";
    providerMessageId?: string;
    error?: {
      code: string;
      message: string;
      outcomeUnknown?: boolean;
    };
  };
  devInvitationLink?: string;
  devInvitationUrl?: string; // backwards compatibility alias
}

export interface ValidatedInvitationMetadata {
  valid: boolean;
  email: string;
  name: string;
  role: Role;
  department?: string;
  designation?: string;
  expiresAt: string;
}

export type ValidateInvitationResponse = ValidatedInvitationMetadata;

export interface AcceptInvitationRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface AcceptInvitationResponse {
  success: boolean;
  message: string;
  email: string;
}

export const invitationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getInvitations: builder.query<InvitationsResponse, InvitationsQuery | void>(
      {
        query: (params) => ({
          url: "/admin/invitations",
          params: params || {},
        }),
        transformResponse: (response: {
          data: Invitation[];
          meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        }) => ({
          data: response.data,
          meta: response.meta,
        }),
        providesTags: ["Invitation"],
      },
    ),

    getInvitationById: builder.query<Invitation, string>({
      query: (id) => `/admin/invitations/${id}`,
      transformResponse: (response: { data: Invitation }) => response.data,
      providesTags: (_result, _error, id) => [{ type: "Invitation", id }],
    }),

    createInvitation: builder.mutation<
      CreateInvitationResponse,
      CreateInvitationRequest
    >({
      query: (body) => ({
        url: "/admin/invitations",
        method: "POST",
        body,
      }),
      transformResponse: (response: { data: CreateInvitationResponse }) =>
        response.data,
      invalidatesTags: ["Invitation", "User"],
    }),

    resendInvitation: builder.mutation<CreateInvitationResponse, string>({
      query: (id) => ({
        url: `/admin/invitations/${id}/resend`,
        method: "POST",
      }),
      transformResponse: (response: { data: CreateInvitationResponse }) =>
        response.data,
      invalidatesTags: ["Invitation"],
    }),

    revokeInvitation: builder.mutation<Invitation, string>({
      query: (id) => ({
        url: `/admin/invitations/${id}/revoke`,
        method: "POST",
      }),
      transformResponse: (response: { data: Invitation }) => response.data,
      invalidatesTags: ["Invitation"],
    }),

    validateInvitationToken: builder.mutation<
      ValidatedInvitationMetadata,
      { token: string }
    >({
      query: (body) => ({
        url: "/auth/invitations/validate",
        method: "POST",
        body,
      }),
      transformResponse: (response: { data: ValidatedInvitationMetadata }) =>
        response.data,
    }),

    getEmailStatus: builder.query<EmailStatusResponse, void>({
      query: () => "/admin/invitations/email-status",
      transformResponse: (response: { data: EmailStatusResponse }) =>
        response.data,
      providesTags: ["EmailStatus"],
    }),

    acceptInvitation: builder.mutation<
      AcceptInvitationResponse,
      AcceptInvitationRequest
    >({
      query: (body) => ({
        url: "/auth/accept-invitation",
        method: "POST",
        body,
      }),
      transformResponse: (response: { data: AcceptInvitationResponse }) =>
        response.data,
      invalidatesTags: ["Invitation", "User"],
    }),
  }),
});

export const {
  useGetInvitationsQuery,
  useGetInvitationByIdQuery,
  useGetEmailStatusQuery,
  useCreateInvitationMutation,
  useResendInvitationMutation,
  useRevokeInvitationMutation,
  useValidateInvitationTokenMutation,
  useAcceptInvitationMutation,
} = invitationsApi;
