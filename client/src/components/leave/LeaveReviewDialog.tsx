import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { useReviewLeaveMutation } from '../../features/leave/leaveApi';
import type { LeaveRequest, User } from '../../types/models';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../lib/utils';
import { CheckCircle2, XCircle, Loader2, Calendar, User as UserIcon } from 'lucide-react';

interface LeaveReviewDialogProps {
  leave: LeaveRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const LeaveReviewDialog: React.FC<LeaveReviewDialogProps> = ({
  leave,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [remarks, setRemarks] = useState('');
  const [reviewLeave, { isLoading }] = useReviewLeaveMutation();

  if (!leave) return null;

  const employee = typeof leave.userId === 'object' ? (leave.userId as User) : null;
  const employeeName = employee?.name || 'Employee';
  const employeeEmail = employee?.email || '';
  const dateStr =
    leave.startDate === leave.endDate
      ? leave.startDate
      : `${leave.startDate} to ${leave.endDate}`;

  const handleReview = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && remarks.trim().length < 5) {
      toast.error('Please enter reviewer remarks of at least 5 characters when rejecting leave');
      return;
    }

    try {
      await reviewLeave({
        id: leave._id,
        action,
        remarks: remarks.trim() || undefined,
      }).unwrap();

      toast.success(
        `Leave request for ${employeeName} has been ${action === 'approve' ? 'approved' : 'rejected'}`
      );
      setRemarks('');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const msg = getApiErrorMessage(err, `Failed to ${action} leave request`);
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] p-6 rounded-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span>Review Leave Request</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Employee Info Header */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/70 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-xs text-foreground">{employeeName}</div>
              <div className="text-[11px] text-muted-foreground">{employeeEmail}</div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-xl border border-border/60 bg-card">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Category
              </div>
              <div className="font-semibold mt-0.5 capitalize">{leave.leaveType} Leave</div>
              {leave.isHalfDay && (
                <div className="text-[10px] text-primary">Half Day ({leave.halfDayPeriod})</div>
              )}
            </div>

            <div className="p-2.5 rounded-xl border border-border/60 bg-card">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Duration
              </div>
              <div className="font-semibold mt-0.5 font-mono">
                {leave.daysCount} {leave.daysCount === 1 ? 'Working Day' : 'Working Days'}
              </div>
            </div>
          </div>

          {/* Date and Reason */}
          <div className="space-y-1 text-xs">
            <span className="text-muted-foreground font-medium">Dates: </span>
            <span className="font-mono font-semibold">{dateStr}</span>
          </div>

          <div className="space-y-1 text-xs">
            <span className="text-muted-foreground font-medium">Reason for Request:</span>
            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60 italic text-foreground/90 leading-relaxed">
              "{leave.reason}"
            </div>
          </div>

          {/* Review Remarks */}
          <div className="space-y-1.5">
            <Label htmlFor="reviewRemarks" className="text-xs font-semibold">
              Review Remarks {remarks.length < 5 && <span className="text-muted-foreground font-normal">(Required if rejecting, min 5 chars)</span>}
            </Label>
            <textarea
              id="reviewRemarks"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add optional notes or required rejection reason..."
              className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-hidden resize-none"
            />
          </div>

          {/* Decision Actions */}
          <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs rounded-lg"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => handleReview('reject')}
                className="h-8 text-xs rounded-lg text-rose-600 hover:bg-rose-500/10 hover:border-rose-500/40 gap-1 font-semibold"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject</span>
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={isLoading}
                onClick={() => handleReview('approve')}
                className="h-8 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Approve</span>
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
