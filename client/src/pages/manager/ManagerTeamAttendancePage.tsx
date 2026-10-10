import React, { useState } from 'react';
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
import { useGetTeamAttendanceQuery } from '../../features/attendance/attendanceApi';
import { useGetTeamUsersQuery } from '../../features/users/usersApi';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const ManagerTeamAttendancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'overtime'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [userId, setUserId] = useState('');
  const [workingStatus, setWorkingStatus] = useState<WorkingStatus | ''>('');
  const [verificationStatus, setVerificationStatus] = useState<
    VerificationStatus | ''
  >('');
  const [overtimeStatus, setOvertimeStatus] = useState<OvertimeStatus | ''>('');
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: teamMembers = [] } = useGetTeamUsersQuery();

  // Tab mapping
  const effectiveVerificationStatus =
    activeTab === 'pending' ? 'pending' : verificationStatus || undefined;
  const effectiveOvertimeStatus =
    activeTab === 'overtime' ? 'pending' : overtimeStatus || undefined;

  const queryParams = {
    from: from || undefined,
    to: to || undefined,
    userId: userId || undefined,
    workingStatus: workingStatus || undefined,
    verificationStatus: effectiveVerificationStatus,
    overtimeStatus: effectiveOvertimeStatus,
    page,
    limit: 15,
  };

  const { data, isLoading, isError, refetch } =
    useGetTeamAttendanceQuery(queryParams);

  const handleResetFilters = () => {
    setFrom('');
    setTo('');
    setUserId('');
    setWorkingStatus('');
    setVerificationStatus('');
    setOvertimeStatus('');
    setSearchQuery('');
    setPage(1);
  };

  const rawRecords = data?.data || [];
  const records = searchQuery
    ? rawRecords.filter((rec) => {
        const emp = typeof rec.employeeId === 'object' ? (rec.employeeId as User) : null;
        return (
          emp?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp?.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      })
    : rawRecords;
  const meta = data?.meta;

  const tabs: TabItem[] = [
    { id: 'all', label: 'All Records', count: meta?.total },
    { id: 'pending', label: 'Pending Verification' },
    { id: 'overtime', label: 'Overtime Requests' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageHeader
            title="Team Schedule & Attendance"
            description="Filter and inspect attendance shifts, verification audits, and overtime for your team"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link to="/manager/reports">
            <Button variant="outline" size="sm" className="gap-1.5 h-9 rounded-xl text-xs font-semibold">
              <Download className="w-3.5 h-3.5" /> Export Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => {
          setActiveTab(id as 'all' | 'pending' | 'overtime');
          setPage(1);
        }}
      />

      {/* Search and Filter Controls Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search team member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Team Members ({teamMembers.length})</option>
            {teamMembers.map((m) => {
              const mId = m.id || m._id || '';
              return (
                <option key={mId} value={mId}>
                  {m.name}
                </option>
              );
            })}
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
            className="h-9 text-xs gap-1 rounded-xl"
            title="Reset filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Attendance Table */}
      {isLoading ? (
        <Skeletons count={5} />
      ) : isError ? (
        <ErrorState
          title="Could not load team attendance records"
          message="An error occurred while fetching team attendance. Please try again."
          onRetry={refetch}
        />
      ) : records.length === 0 ? (
        <EmptyState
          title="No team attendance records found"
          description="Try adjusting your filters or date range to find matching attendance records."
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
                    <th className="py-3.5 px-4">Verification</th>
                    <th className="py-3.5 px-4">Overtime</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
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
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <EmployeeCell employee={emp} />
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                          {rec.workDate}
                        </td>
                        <td className="py-3 px-4">
                          <AttendanceTimeline
                            punchInAt={rec.punchIn?.at}
                            punchOutAt={rec.punchOut?.at}
                            workedMinutes={rec.workedMinutes}
                            workingStatus={rec.workingStatus}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge
                            kind="verification"
                            status={rec.verification?.status}
                            size="sm"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge
                            kind="overtime"
                            status={rec.overtime?.status}
                            size="sm"
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRecord(rec);
                              setDialogOpen(true);
                            }}
                            className="h-8 rounded-xl text-xs font-semibold hover:border-primary hover:text-primary transition-all"
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

            {/* Pagination footer */}
            {meta && meta.totalPages > 1 && (
              <div className="p-3 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                <span>
                  Showing Page {meta.page} of {meta.totalPages} ({meta.total} records total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
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
