import React, { useState } from 'react';
import {
  useGetTeamLeavesQuery,
  useGetAllLeavesQuery,
} from '../../features/leave/leaveApi';
import type { LeaveRequest, LeaveStatus, LeaveType, User } from '../../types/models';
import { StatusBadge } from '../common/StatusBadge';
import { Skeletons } from '../common/Skeletons';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';
import { Button } from '../ui/button';
import { LeaveReviewDialog } from './LeaveReviewDialog';
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface LeaveReviewTableProps {
  mode: 'manager' | 'admin';
}

export const LeaveReviewTable: React.FC<LeaveReviewTableProps> = ({ mode }) => {
  const [status, setStatus] = useState<LeaveStatus | ''>('pending');
  const [leaveType, setLeaveType] = useState<LeaveType | ''>('');
  const [page, setPage] = useState(1);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const queryParams = {
    status: status || undefined,
    leaveType: leaveType || undefined,
    page,
    limit: 15,
  };

  const managerQueryResult = useGetTeamLeavesQuery(queryParams, {
    skip: mode !== 'manager',
  });
  const adminQueryResult = useGetAllLeavesQuery(queryParams, {
    skip: mode !== 'admin',
  });

  const queryResult = mode === 'manager' ? managerQueryResult : adminQueryResult;
  const { data, isLoading, isError, refetch } = queryResult;

  const leaves = data?.data || [];
  const meta = data?.meta;

  const handleOpenReview = (leave: LeaveRequest) => {
    setSelectedLeave(leave);
    setReviewOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as LeaveStatus | '');
              setPage(1);
            }}
            className="h-8 rounded-xl border border-input bg-card px-2.5 text-xs font-medium focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={leaveType}
            onChange={(e) => {
              setLeaveType(e.target.value as LeaveType | '');
              setPage(1);
            }}
            className="h-8 rounded-xl border border-input bg-card px-2.5 text-xs font-medium focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Categories</option>
            <option value="annual">Annual</option>
            <option value="sick">Sick</option>
            <option value="casual">Casual</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <Skeletons count={5} />
      ) : isError ? (
        <ErrorState
          title="Could not load leave requests"
          message="Failed to retrieve workforce leave queue. Please retry."
          onRetry={refetch}
        />
      ) : leaves.length === 0 ? (
        <EmptyState
          title="No leave requests in queue"
          description={
            status === 'pending'
              ? 'There are currently no pending leave requests awaiting your review.'
              : 'No leave records found matching the selected filters.'
          }
        />
      ) : (
        <div className="border border-border/70 rounded-2xl bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider font-bold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Working Days</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {leaves.map((leave: LeaveRequest) => {
                  const emp = typeof leave.userId === 'object' ? (leave.userId as User) : null;
                  const isPending = leave.status === 'pending';
                  const dateStr =
                    leave.startDate === leave.endDate
                      ? leave.startDate
                      : `${leave.startDate} to ${leave.endDate}`;

                  return (
                    <tr key={leave._id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">
                          {emp?.name || 'Employee'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {emp?.email || ''}
                        </div>
                        {emp?.department && (
                          <div className="text-[10px] text-muted-foreground/75 mt-0.5">
                            {emp.department} {emp.designation ? `• ${emp.designation}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold capitalize text-foreground">
                          {leave.leaveType}
                        </span>
                        {leave.isHalfDay && (
                          <div className="text-[10px] text-primary">
                            Half Day ({leave.halfDayPeriod})
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{dateStr}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {leave.daysCount} {leave.daysCount === 1 ? 'day' : 'days'}
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <p className="truncate text-muted-foreground" title={leave.reason}>
                          {leave.reason}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge type="leave" status={leave.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isPending ? (
                          <Button
                            size="sm"
                            onClick={() => handleOpenReview(leave)}
                            className="h-7 text-xs rounded-lg gap-1 font-semibold"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </Button>
                        ) : (
                          <div className="text-[10px] text-muted-foreground/80 text-right">
                            {leave.reviewedBy && typeof leave.reviewedBy === 'object' ? (
                              <span>By {(leave.reviewedBy as User).name}</span>
                            ) : (
                              <span>Reviewed</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="p-3 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
              <span>
                Page {meta.page} of {meta.totalPages} ({meta.total} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs rounded-lg"
                  disabled={meta.page <= 1}
                  onClick={() => setPage(Math.max(1, meta.page - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs rounded-lg"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage(meta.page + 1)}
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      <LeaveReviewDialog
        leave={selectedLeave}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />
    </div>
  );
};
