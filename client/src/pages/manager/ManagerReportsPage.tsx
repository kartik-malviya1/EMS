import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Skeletons } from '../../components/common/Skeletons';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmployeeCell } from '../../components/common/EmployeeCell';
import { AttendanceTimeline } from '../../components/common/AttendanceTimeline';
import {
  useGetDailyReportQuery,
  downloadReportExport,
} from '../../features/reports/reportsApi';
import { useGetTeamUsersQuery } from '../../features/users/usersApi';
import type { User } from '../../types/models';
import {
  FileSpreadsheet,
  FileText,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

export const ManagerReportsPage: React.FC = () => {
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [userId, setUserId] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const { data: teamMembers = [] } = useGetTeamUsersQuery();

  const queryParams = {
    date: date || undefined,
    from: from || undefined,
    to: to || undefined,
    userId: userId || undefined,
    page,
    limit: 15,
  };

  const { data, isLoading, isError, refetch } =
    useGetDailyReportQuery(queryParams);

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    try {
      setIsExporting(true);
      await downloadReportExport({
        format,
        date: date || undefined,
        from: from || undefined,
        to: to || undefined,
        userId: userId || undefined,
      });
      toast.success(
        `Report export (${format.toUpperCase()}) downloaded successfully`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to export report'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetFilters = () => {
    setDate('');
    setFrom('');
    setTo('');
    setUserId('');
    setPage(1);
  };

  const rows = data?.rows || [];
  const summary = data?.summary;
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageHeader
            title="Team Attendance Reports"
            description="Detailed daily shift reports, summaries, and export downloads for your team"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
            className="gap-1.5 h-9 rounded-xl text-xs font-semibold hover:border-emerald-500/40 hover:text-emerald-600 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export XLSX
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
            className="gap-1.5 h-9 rounded-xl text-xs font-semibold hover:border-rose-500/40 hover:text-rose-600 transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/70 rounded-2xl shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Specific Date
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setFrom('');
                  setTo('');
                  setPage(1);
                }}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                From Date
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setDate('');
                  setPage(1);
                }}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                To Date
              </label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setDate('');
                  setPage(1);
                }}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Team Member
              </label>
              <select
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 rounded-xl border border-input bg-card px-2.5 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">All Members ({teamMembers.length})</option>
                {teamMembers.map((m) => {
                  const mId = m.id || m._id || '';
                  return (
                    <option key={mId} value={mId}>
                      {m.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 w-full text-xs gap-1 rounded-xl"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Records
            </span>
            <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
              {summary.totalRecords || 0}
            </span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Completed
            </span>
            <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
              {summary.workingStatus?.completed || 0}
            </span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
              Incomplete
            </span>
            <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
              {summary.workingStatus?.incomplete || 0}
            </span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
              Missed
            </span>
            <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
              {summary.workingStatus?.missed || 0}
            </span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 block">
              Pending Audit
            </span>
            <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
              {summary.verificationStatus?.pending || 0}
            </span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 block">
              Pending OT
            </span>
            <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
              {summary.overtimeStatus?.pending || 0}
            </span>
          </div>
        </div>
      )}

      {/* Report Table */}
      {isLoading ? (
        <Skeletons count={5} />
      ) : isError ? (
        <ErrorState
          title="Failed to load daily report"
          message="Could not retrieve report data. Please try again."
          onRetry={refetch}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No attendance records found for this period"
          description="Adjust your filters or date selection to see report records."
        />
      ) : (
        <div className="space-y-4">
          <div className="border border-border/70 rounded-2xl bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider font-bold text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Work Date</th>
                    <th className="py-3.5 px-4">Clock-in & Out</th>
                    <th className="py-3.5 px-4">Shift Status</th>
                    <th className="py-3.5 px-4">Verification</th>
                    <th className="py-3.5 px-4">Overtime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <EmployeeCell
                          employee={
                            {
                              name: row.employeeName,
                              email: row.employeeEmail,
                            } as unknown as User
                          }
                        />
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-foreground whitespace-nowrap">
                        {row.workDate}
                      </td>
                      <td className="py-3.5 px-4">
                        <AttendanceTimeline
                          punchInAt={row.punchInAt}
                          punchOutAt={row.punchOutAt}
                          workedMinutes={row.workedMinutes}
                          workingStatus={row.workingStatus}
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          kind="working"
                          status={row.workingStatus}
                          size="sm"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          kind="verification"
                          status={row.verificationStatus}
                          size="sm"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          kind="overtime"
                          status={row.overtimeStatus}
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {meta && meta.totalPages > 1 && (
              <div className="p-3 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                <span>
                  Showing Page {meta.page} of {meta.totalPages} ({meta.total} rows total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs rounded-lg"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs rounded-lg"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
