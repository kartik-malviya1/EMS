import React, { useState, useTransition } from 'react';
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
import { ReportVisualizations } from '../../components/reports/ReportVisualizations';
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
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

type PeriodType = 'daily' | 'weekly';

const getTodayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getWeekBounds = (anchorDateStr: string) => {
  const base = anchorDateStr ? new Date(`${anchorDateStr}T00:00:00`) : new Date();
  const day = base.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  return {
    from: fmt(monday),
    to: fmt(sunday),
  };
};

export const ManagerReportsPage: React.FC = () => {
  const [periodType, setPeriodType] = useState<PeriodType>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [userId, setUserId] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'xlsx' | null>(null);
  const [isPending, startTransition] = useTransition();

  const { data: teamMembers = [] } = useGetTeamUsersQuery();

  const weekBounds = getWeekBounds(selectedDate);

  const queryParams = {
    date: periodType === 'daily' ? (selectedDate || undefined) : undefined,
    from: periodType === 'weekly' ? weekBounds.from : undefined,
    to: periodType === 'weekly' ? weekBounds.to : undefined,
    userId: userId || undefined,
    page,
    limit: 15,
  };

  const { data, isLoading, isError, refetch } =
    useGetDailyReportQuery(queryParams);

  const handlePeriodChange = (type: PeriodType) => {
    startTransition(() => {
      setPeriodType(type);
      setPage(1);
    });
  };

  const handleDateChange = (val: string) => {
    startTransition(() => {
      setSelectedDate(val);
      setPage(1);
    });
  };

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      setPage(newPage);
    });
  };

  const handleMemberChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    startTransition(() => {
      setUserId(val);
      setPage(1);
    });
  };

  const handleResetFilters = () => {
    startTransition(() => {
      setSelectedDate(getTodayStr());
      setUserId('');
      setPage(1);
    });
  };

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    try {
      setIsExporting(true);
      setExportingFormat(format);
      await downloadReportExport({
        format,
        date: periodType === 'daily' ? (selectedDate || undefined) : undefined,
        from: periodType === 'weekly' ? weekBounds.from : undefined,
        to: periodType === 'weekly' ? weekBounds.to : undefined,
        userId: userId || undefined,
      });
      toast.success(
        `Team report (${format.toUpperCase()}) downloaded successfully`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to export report'
      );
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  const rows = data?.rows || [];
  const summary = data?.summary;
  const meta = data?.meta;

  const activePeriodLabel =
    periodType === 'daily'
      ? selectedDate ? `Date: ${selectedDate}` : 'All Dates'
      : `Week: ${weekBounds.from} to ${weekBounds.to}`;

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
          {/* Primary Action Button */}
          <Button
            variant="default"
            size="sm"
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
            className="gap-2 h-9 rounded-xl text-xs font-semibold shadow-xs"
          >
            {isExporting && exportingFormat === 'pdf' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            {isExporting && exportingFormat === 'pdf' ? 'Generating PDF...' : 'Generate Report'}
          </Button>

          {/* Secondary Action Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
            className="gap-1.5 h-9 rounded-xl text-xs font-semibold hover:border-emerald-500/40 hover:text-emerald-600 transition-all"
          >
            {isExporting && exportingFormat === 'xlsx' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            )}
            {isExporting && exportingFormat === 'xlsx' ? 'Exporting...' : 'Export XLSX'}
          </Button>
        </div>
      </div>

      {/* Period Selection & Filter Bar */}
      <Card className="border-border/70 rounded-2xl shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
            {/* 1. Daily / Weekly Selector */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Period Mode
              </label>
              <div className="inline-flex w-full rounded-xl p-0.5 bg-muted/60 border border-border/70">
                <button
                  type="button"
                  onClick={() => handlePeriodChange('daily')}
                  className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                    periodType === 'daily'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodChange('weekly')}
                  className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                    periodType === 'weekly'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {/* 2. Date Picker appropriate to selected period */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                {periodType === 'daily' ? 'Report Date' : 'Week Anchor'}
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            {/* Team Member Filter */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Team Member
              </label>
              <select
                value={userId}
                onChange={handleMemberChange}
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

            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 w-full text-xs gap-1 rounded-xl"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Today
              </Button>
            </div>
          </div>

          {/* Active Period Description Bar */}
          <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground gap-1">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
              <span>
                Active Selection:{' '}
                <strong className="text-foreground font-mono">
                  {periodType === 'daily'
                    ? `Single Day: ${selectedDate || 'Today'}`
                    : `Week: ${weekBounds.from} → ${weekBounds.to} (Monday – Sunday)`}
                </strong>
              </span>
            </div>
            <span className="text-[11px]">
              {meta?.total ?? rows.length} shift record(s) found
            </span>
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
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
              Total Worked
            </span>
            <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
              {summary.totalWorkedHours ?? 0}h
            </span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 block">
              Pending Reviews
            </span>
            <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
              {(summary.verificationStatus?.pending || 0) + (summary.overtimeStatus?.pending || 0)}
            </span>
          </div>
        </div>
      )}

      {/* Visualizations (Shift Distribution, Attendance by Day, Verification & Overtime Audit) */}
      {summary && (
        <ReportVisualizations
          summary={summary}
          totalRecords={meta?.total ?? rows.length}
          periodLabel={activePeriodLabel}
        />
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
        <section
          aria-busy={isPending}
          className={`space-y-4 transition-opacity duration-150 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
        >
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
                    onClick={() => handlePageChange(Math.max(1, meta.page - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs rounded-lg"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => handlePageChange(meta.page + 1)}
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
