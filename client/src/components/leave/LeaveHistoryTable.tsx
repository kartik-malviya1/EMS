import React, { useState } from 'react';
import {
  useGetMyLeavesQuery,
  useCancelLeaveMutation,
} from '../../features/leave/leaveApi';
import type { LeaveRequest, LeaveStatus, LeaveType } from '../../types/models';
import { StatusBadge } from '../common/StatusBadge';
import { Skeletons } from '../common/Skeletons';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../lib/utils';
import {
  Calendar,
  Ban,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

export const LeaveHistoryTable: React.FC = () => {
  const [status, setStatus] = useState<LeaveStatus | ''>('');
  const [leaveType, setLeaveType] = useState<LeaveType | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useGetMyLeavesQuery({
    status: status || undefined,
    leaveType: leaveType || undefined,
    page,
    limit: 10,
  });

  const [cancelLeave, { isLoading: isCancelling }] = useCancelLeaveMutation();

  const leaves = data?.data || [];
  const meta = data?.meta;

  const handleCancel = async (id: string, dates: string) => {
    if (!window.confirm(`Are you sure you want to cancel your leave request for ${dates}?`)) {
      return;
    }

    try {
      await cancelLeave(id).unwrap();
      toast.success('Leave request has been cancelled');
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to cancel leave request');
      toast.error(msg);
    }
  };

  const formatLeaveType = (type: LeaveType) => {
    switch (type) {
      case 'annual':
        return 'Annual Leave';
      case 'sick':
        return 'Sick Leave';
      case 'casual':
        return 'Casual Leave';
      case 'unpaid':
        return 'Unpaid Leave';
      default:
        return type;
    }
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
            <option value="pending">Pending</option>
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
            <option value="annual">Annual Leave</option>
            <option value="sick">Sick Leave</option>
            <option value="casual">Casual Leave</option>
            <option value="unpaid">Unpaid Leave</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <Skeletons count={4} />
      ) : isError ? (
        <ErrorState
          title="Could not load leave records"
          message="Failed to retrieve your leave history. Please retry."
          onRetry={refetch}
        />
      ) : leaves.length === 0 ? (
        <EmptyState
          title="No leave requests found"
          description="You have not submitted any leave requests matching the selected filters."
        />
      ) : (
        <div className="border border-border/70 rounded-2xl bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider font-bold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reviewer Remarks</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {leaves.map((leave: LeaveRequest) => {
                  const isPending = leave.status === 'pending';
                  const dateStr =
                    leave.startDate === leave.endDate
                      ? leave.startDate
                      : `${leave.startDate} to ${leave.endDate}`;

                  return (
                    <tr key={leave._id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">
                          {formatLeaveType(leave.leaveType)}
                        </div>
                        {leave.isHalfDay && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Half Day (
                            {leave.halfDayPeriod === 'first_half'
                              ? 'Morning'
                              : 'Afternoon'}
                            )
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{dateStr}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-foreground">
                          {leave.daysCount} {leave.daysCount === 1 ? 'day' : 'days'}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-[220px]">
                        <p className="truncate text-muted-foreground" title={leave.reason}>
                          {leave.reason}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge type="leave" status={leave.status} />
                      </td>
                      <td className="py-3 px-4 max-w-[200px] text-muted-foreground">
                        {leave.reviewerRemarks ? (
                          <span title={leave.reviewerRemarks} className="italic text-[11px]">
                            "{leave.reviewerRemarks}"
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isPending ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isCancelling}
                            onClick={() => handleCancel(leave._id, dateStr)}
                            className="h-7 text-xs rounded-lg gap-1 text-destructive hover:bg-destructive/10"
                            title="Cancel this pending leave request"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Cancel</span>
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/50">—</span>
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
    </div>
  );
};
