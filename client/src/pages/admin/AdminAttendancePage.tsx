import React, { useState, useTransition } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Skeletons } from '../../components/common/Skeletons';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { AttendanceReviewDialog } from '../../components/review/AttendanceReviewDialog';
import { TabNavigation, type TabItem } from '../../components/common/TabNavigation';
import { EmployeeCell } from '../../components/common/EmployeeCell';
import { AttendanceTimeline } from '../../components/common/AttendanceTimeline';
import { formatDate } from '../../lib/labels';
import { useGetAllAttendanceQuery } from '../../features/attendance/attendanceApi';
import type {
  Attendance,
  User,
  WorkingStatus,
  VerificationStatus,
  OvertimeStatus,
} from '../../types/models';
import {
  Download,
  Search,
  RotateCcw,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const AdminAttendancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'overtime'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [role, setRole] = useState<string>('');
  const [workingStatus, setWorkingStatus] = useState<WorkingStatus | ''>('');
  const [verificationStatus, setVerificationStatus] = useState<
    VerificationStatus | ''
  >('');
  const [overtimeStatus, setOvertimeStatus] = useState<OvertimeStatus | ''>('');
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Effective tab filters
  const effectiveVerificationStatus =
    activeTab === 'pending' ? 'pending' : verificationStatus || undefined;
  const effectiveOvertimeStatus =
    activeTab === 'overtime' ? 'pending' : overtimeStatus || undefined;

  const queryParams = {
    from: from || undefined,
    to: to || undefined,
    role: role || undefined,
    workingStatus: workingStatus || undefined,
    verificationStatus: effectiveVerificationStatus,
    overtimeStatus: effectiveOvertimeStatus,
    page,
    limit: 15,
  };

  const { data, isLoading, isError, isFetching, refetch } =
    useGetAllAttendanceQuery(queryParams);

  const handleTabChange = (tabId: string) => {
    startTransition(() => {
      setActiveTab(tabId as 'all' | 'pending' | 'overtime');
      setPage(1);
    });
  };

  const handleResetFilters = () => {
    startTransition(() => {
      setFrom('');
      setTo('');
      setRole('');
      setWorkingStatus('');
      setVerificationStatus('');
      setOvertimeStatus('');
      setSearchQuery('');
      setPage(1);
    });
  };

  const rawRecords = data?.data || [];
  const records = searchQuery
    ? rawRecords.filter((rec) => {
        const emp =
          typeof rec.employeeId === 'object' && rec.employeeId !== null
            ? (rec.employeeId as User)
            : null;
        return (
          emp?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp?.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      })
    : rawRecords;
  const meta = data?.meta;

  const tabs: TabItem[] = [
    { id: 'all', label: 'All Records', count: activeTab === 'all' ? meta?.total : undefined },
    { id: 'pending', label: 'Pending Verification', count: activeTab === 'pending' ? meta?.total : undefined, highlightCount: true },
    { id: 'overtime', label: 'Overtime Requests', count: activeTab === 'overtime' ? meta?.total : undefined },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageHeader
            title="System Attendance Records"
            description="Audit, inspect, and verify shifts across all employees, managers, and administrators"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/reports">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 rounded-xl text-xs font-semibold hover:border-primary hover:text-primary transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs with consistent underline indicator */}
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onChange={handleTabChange}
      />

      {/* Search and Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search employee by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Roles</option>
            <option value="employee">Employees</option>
            <option value="manager">Managers</option>
            <option value="admin">Administrators</option>
          </select>

          <select
            value={workingStatus}
            onChange={(e) => {
              setWorkingStatus(e.target.value as WorkingStatus | '');
              setPage(1);
            }}
            className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Shift Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed (8+ h)</option>
            <option value="incomplete">Incomplete (&lt;8 h)</option>
            <option value="missed">Missed / Auto-closed</option>
          </select>

          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="h-9 w-36 text-xs rounded-xl"
            title="From date"
          />

          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="h-9 w-36 text-xs rounded-xl"
            title="To date"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="h-9 px-2 text-xs gap-1 rounded-xl text-muted-foreground hover:text-foreground"
            title="Reset filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="h-9 px-3 text-xs gap-1.5 rounded-xl border-border/70 hover:bg-muted/60"
            title="Refresh records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Attendance Table with Stable Fixed Column Widths across Tabs */}
      <section
        aria-busy={isPending}
        className={`space-y-4 transition-opacity duration-200 ${
          isPending ? 'opacity-70' : 'opacity-100'
        }`}
      >
        {isLoading ? (
          <Skeletons count={5} />
        ) : isError ? (
          <ErrorState
            title="Could not load system attendance"
            message="Failed to retrieve records. Please try again."
            onRetry={refetch}
          />
        ) : records.length === 0 ? (
          <EmptyState
            title="No attendance records match your criteria"
            description="Adjust your filters or date range to see matching shifts."
          />
        ) : (
          <div className="space-y-4">
            <div className="border border-border/70 rounded-2xl bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left table-fixed min-w-[1020px] border-collapse">
                  <colgroup>
                    <col className="w-[260px]" />
                    <col className="w-[95px]" />
                    <col className="w-[125px]" />
                    <col className="w-[170px]" />
                    <col className="w-[145px]" />
                    <col className="w-[120px]" />
                    <col className="w-[120px]" />
                    <col className="w-[85px]" />
                  </colgroup>
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider font-bold text-[11px] h-11">
                    <tr>
                      <th className="py-3 px-4 font-bold align-middle">Employee</th>
                      <th className="py-3 px-4 font-bold align-middle">Role</th>
                      <th className="py-3 px-4 font-bold align-middle">Work Date</th>
                      <th className="py-3 px-4 font-bold align-middle">Clock-in & Out</th>
                      <th className="py-3 px-4 font-bold align-middle">Shift Status</th>
                      <th className="py-3 px-4 font-bold align-middle">Verification</th>
                      <th className="py-3 px-4 font-bold align-middle">Overtime</th>
                      <th className="py-3 px-4 font-bold align-middle text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {records.map((rec) => {
                      const emp =
                        typeof rec.employeeId === 'object' &&
                        rec.employeeId !== null
                          ? (rec.employeeId as User)
                          : null;

                       return (
                        <tr
                          key={rec.id || rec._id}
                          className="hover:bg-muted/30 transition-colors h-14"
                        >
                          <td className="py-2.5 px-4 align-middle">
                            <EmployeeCell employee={emp} />
                          </td>
                          <td className="py-2.5 px-4 align-middle">
                            <span className="capitalize text-muted-foreground font-semibold px-2 py-0.5 rounded-full bg-muted/60 text-[11px] inline-block">
                              {emp?.role || 'employee'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 align-middle text-xs font-semibold text-foreground whitespace-nowrap">
                            {formatDate(rec.workDate)}
                          </td>
                          <td className="py-2.5 px-4 align-middle">
                            <AttendanceTimeline
                              punchInAt={rec.punchIn?.at}
                              punchOutAt={rec.punchOut?.at}
                              workedMinutes={rec.workedMinutes}
                              workingStatus={rec.workingStatus}
                            />
                          </td>
                          <td className="py-2.5 px-4 align-middle">
                            <StatusBadge
                              kind="working"
                              status={rec.workingStatus}
                              size="sm"
                            />
                          </td>
                          <td className="py-2.5 px-4 align-middle">
                            <StatusBadge
                              kind="verification"
                              status={rec.verification?.status || 'pending'}
                              size="sm"
                            />
                          </td>
                          <td className="py-2.5 px-4 align-middle">
                            <StatusBadge
                              kind="overtime"
                              status={rec.overtime?.status || 'not_requested'}
                              size="sm"
                            />
                          </td>
                          <td className="py-2.5 px-4 align-middle text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 rounded-xl text-xs font-semibold hover:border-primary hover:text-primary transition-all"
                              onClick={() => {
                                setSelectedRecord(rec);
                                setDialogOpen(true);
                              }}
                            >
                              Review
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {meta && (
                <div className="p-3 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/20">
                  <span>
                    Showing Page <span className="font-semibold text-foreground">{meta.page}</span> of{' '}
                    <span className="font-semibold text-foreground">{meta.totalPages}</span> ({meta.total} records total)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-xl gap-1 px-3"
                      disabled={meta.page <= 1}
                      onClick={() => startTransition(() => setPage((p) => Math.max(1, p - 1)))}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-xl gap-1 px-3"
                      disabled={meta.page >= meta.totalPages}
                      onClick={() => startTransition(() => setPage((p) => p + 1))}
                    >
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Review Dialog */}
      <AttendanceReviewDialog
        attendance={selectedRecord}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={refetch}
      />
    </div>
  );
};
