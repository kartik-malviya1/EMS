import { apiSlice } from '../api/apiSlice';
import type {
  ReportRow,
  PaginationMeta,
  WorkingStatus,
  VerificationStatus,
  OvertimeStatus,
} from '../../types/models';

export interface ReportQueryParams {
  date?: string;
  from?: string;
  to?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

export interface ReportSummary {
  workingStatus?: Record<WorkingStatus, number>;
  verificationStatus?: Record<VerificationStatus, number>;
  overtimeStatus?: Record<OvertimeStatus, number>;
  totalRecords?: number;
}

export interface ReportResult {
  rows: ReportRow[];
  summary?: ReportSummary;
  meta?: PaginationMeta & { summary?: ReportSummary };
}

export const reportsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDailyReport: builder.query<ReportResult, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/daily',
        params: params || {},
      }),
      transformResponse: (response: {
        success: boolean;
        data: ReportRow[];
        summary?: ReportSummary;
        meta?: PaginationMeta & { summary?: ReportSummary };
      }) => ({
        rows: response.data,
        summary: {
          ...(response.summary || response.meta?.summary),
          totalRecords: response.meta?.total ?? 0,
        },
        meta: response.meta,
      }),
      providesTags: ['Report'],
    }),
  }),
});

export const { useGetDailyReportQuery } = reportsApi;

export async function downloadReportExport(
  params: ReportQueryParams & { format: 'xlsx' | 'pdf' }
) {
  const query = new URLSearchParams();
  if (params.format) query.set('format', params.format);
  if (params.date) query.set('date', params.date);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.userId) query.set('userId', params.userId);

  const res = await fetch(`/api/reports/daily/export?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(
      errorData?.error?.message || `Failed to export report (${res.status})`
    );
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  let filename = `attendance-report-${params.date || 'export'}.${params.format}`;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) filename = match[1];
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
