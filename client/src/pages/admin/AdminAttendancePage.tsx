import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Skeletons } from '../../components/common/Skeletons';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { AttendanceReviewDialog } from '../../components/review/AttendanceReviewDialog';
import { useGetAllAttendanceQuery } from '../../features/attendance/attendanceApi';
import type {
  Attendance,
  User,
  WorkingStatus,
  VerificationStatus,
  OvertimeStatus,
} from '../../types/models';
import {
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const AdminAttendancePage: React.FC = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [role, setRole] = useState<string>('');
  const [workingStatus, setWorkingStatus] = useState<WorkingStatus | ''>('');
  const [verificationStatus, setVerificationStatus] = useState<
    VerificationStatus | ''
  >('');
  const [overtimeStatus, setOvertimeStatus] = useState<OvertimeStatus | ''>('');
  const [page, setPage] = useState(1);

  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const queryParams = {
    from: from || undefined,
    to: to || undefined,
    role: role || undefined,
    workingStatus: workingStatus || undefined,
    verificationStatus: verificationStatus || undefined,
    overtimeStatus: overtimeStatus || undefined,
    page,
    limit: 15,
  };

  const { data, isLoading, isError, refetch } =
    useGetAllAttendanceQuery(queryParams);

  const handleResetFilters = () => {
    setFrom('');
    setTo('');
    setRole('');
    setWorkingStatus('');
    setVerificationStatus('');
    setOvertimeStatus('');
    setPage(1);
  };

  const records = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Attendance Records"
        description="Search, audit, and inspect shift history and selfies across all employees, managers, and administrators"
      />

      {/* Filter Bar */}
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                From Date
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
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
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Role Filter
              </label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">All Roles</option>
                <option value="employee">Employees</option>
                <option value="manager">Managers</option>
                <option value="admin">Administrators</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Shift Status
              </label>
              <select
                value={workingStatus}
                onChange={(e) => {
                  setWorkingStatus(e.target.value as WorkingStatus | '');
                  setPage(1);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">All Statuses</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed (8+ h)</option>
                <option value="incomplete">Incomplete (&lt;8 h)</option>
                <option value="missed">Missed / Auto-closed</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Verification
              </label>
              <select
                value={verificationStatus}
                onChange={(e) => {
                  setVerificationStatus(
                    e.target.value as VerificationStatus | ''
                  );
                  setPage(1);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">All Verification</option>
                <option value="pending">Pending</option>
                <option value="valid">Valid</option>
                <option value="invalid">Invalid</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 w-full text-xs gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
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
          <div className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border/70 text-muted-foreground uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Punch In</th>
                    <th className="py-3 px-4">Punch Out</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Shift Status</th>
                    <th className="py-3 px-4">Verification</th>
                    <th className="py-3 px-4">Overtime</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {records.map((rec) => {
                    const emp =
                      typeof rec.employeeId === 'object' &&
                      rec.employeeId !== null
                        ? (rec.employeeId as User)
                        : null;
                    const punchInTime = rec.punchIn?.at
                      ? new Date(rec.punchIn.at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—';
                    const punchOutTime = rec.punchOut?.at
                      ? new Date(rec.punchOut.at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—';

                    return (
                      <tr
                        key={rec.id || rec._id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-4 font-semibold text-foreground">
                          <div>{emp?.name || 'User'}</div>
                          <div className="text-[11px] font-normal text-muted-foreground">
                            {emp?.email}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize text-muted-foreground font-medium">
                            {emp?.role || 'employee'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {rec.workDate}
                        </td>
                        <td className="py-3 px-4">{punchInTime}</td>
                        <td className="py-3 px-4">{punchOutTime}</td>
                        <td className="py-3 px-4">
                          {rec.workedMinutes != null
                            ? `${rec.workedMinutes}m (${(rec.workedMinutes / 60).toFixed(1)}h)`
                            : 'In progress'}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge
                            kind="working"
                            status={rec.workingStatus}
                            size="sm"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge
                            kind="verification"
                            status={rec.verification?.status || 'pending'}
                            size="sm"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge
                            kind="overtime"
                            status={rec.overtime?.status || 'not_requested'}
                            size="sm"
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => {
                              setSelectedRecord(rec);
                              setDialogOpen(true);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" /> Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {meta && meta.totalPages > 1 && (
              <div className="p-3 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                <span>
                  Page {meta.page} of {meta.totalPages} ({meta.total} records)
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
