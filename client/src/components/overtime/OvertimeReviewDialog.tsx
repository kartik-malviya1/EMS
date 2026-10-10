import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { StatusBadge } from '../common/StatusBadge';
import { Clock, History, AlertCircle } from 'lucide-react';
import { useReviewOvertimeMutation } from '../../features/attendance/attendanceApi';
import type { Attendance, User } from '../../types/models';
import { toast } from 'sonner';

interface OvertimeReviewDialogProps {
  attendance: Attendance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const OvertimeReviewDialog: React.FC<OvertimeReviewDialogProps> = ({
  attendance,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [remarks, setRemarks] = useState('');
  const [reviewOvertime, { isLoading }] = useReviewOvertimeMutation();

  if (!attendance) return null;

  const attendanceId = attendance.id || attendance._id || '';
  const employee =
    typeof attendance.employeeId === 'object' && attendance.employeeId !== null
      ? (attendance.employeeId as User)
      : null;
  const employeeName = employee?.name || 'Employee';
  const employeeEmail = employee?.email || '';

  const requestedMinutes = attendance.overtime?.requestedMinutes || 0;
  const requestedHours = (requestedMinutes / 60).toFixed(2);
  const overtimeReason =
    attendance.overtime?.reason || 'No reason specified by employee';

  const handleReview = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && remarks.trim().length < 5) {
      toast.error('Remarks must be at least 5 characters when rejecting overtime.');
      return;
    }

    try {
      await reviewOvertime({
        id: attendanceId,
        decision,
        remarks: remarks.trim() || undefined,
      }).unwrap();

      toast.success(
        `Overtime request has been ${decision === 'approved' ? 'approved' : 'rejected'}`
      );
      setRemarks('');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const errorPayload = err as {
        data?: { error?: { message?: string } };
        error?: string;
      };
      const message =
        errorPayload?.data?.error?.message ||
        errorPayload?.error ||
        'Failed to review overtime request';
      toast.error(message);
    }
  };

  const isRejectDisabled = isLoading || remarks.trim().length < 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold">
                Review Overtime Request
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {employeeName} ({employeeEmail}) • Date: {attendance.workDate}
              </DialogDescription>
            </div>
            <StatusBadge
              kind="overtime"
              status={attendance.overtime?.status || 'pending'}
              size="sm"
            />
          </div>
        </DialogHeader>

        {/* Overtime Details Card */}
        <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3 mt-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-muted-foreground block text-[11px] uppercase tracking-wider font-semibold">
                Shift Worked Total
              </span>
              <span className="font-bold text-foreground text-sm flex items-center gap-1.5 mt-0.5">
                <Clock className="w-4 h-4 text-primary" />
                {attendance.workedMinutes != null
                  ? `${attendance.workedMinutes} mins (${(attendance.workedMinutes / 60).toFixed(2)} hrs)`
                  : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px] uppercase tracking-wider font-semibold">
                Requested Overtime
              </span>
              <span className="font-bold text-primary text-sm flex items-center gap-1.5 mt-0.5">
                <Clock className="w-4 h-4 text-primary" />
                {requestedMinutes} mins ({requestedHours} hrs)
              </span>
            </div>
          </div>

          <div className="border-t border-border/60 pt-2">
            <span className="text-muted-foreground block text-[11px] uppercase tracking-wider font-semibold mb-1">
              Employee Reason
            </span>
            <div className="p-2.5 rounded-lg bg-background border border-border/60 text-foreground italic">
              &quot;{overtimeReason}&quot;
            </div>
          </div>
        </div>

        {/* History if available */}
        {attendance.overtime?.history &&
          attendance.overtime.history.length > 0 && (
            <div className="mt-2 border-t border-border/60 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                <History className="w-3.5 h-3.5" /> Previous Overtime History (
                {attendance.overtime.history.length})
              </h4>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {attendance.overtime.history.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg border border-border/60 bg-muted/30 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        kind="overtime"
                        status={item.status}
                        size="sm"
                      />
                      <span className="text-muted-foreground text-[11px]">
                        {item.requestedMinutes} mins
                      </span>
                    </div>
                    <span className="text-muted-foreground text-[11px]">
                      {item.reviewedAt
                        ? new Date(item.reviewedAt).toLocaleDateString()
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Remarks Input */}
        <div className="mt-2">
          <label className="block text-xs font-semibold mb-1 text-foreground">
            Review Remarks{' '}
            <span className="text-destructive font-normal">
              (required for Rejection, min 5 chars)
            </span>
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Add comments or justification for approval/rejection..."
            className="w-full text-xs rounded-xl border border-input bg-background p-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          />
          <div className="flex justify-between items-center text-[11px] text-muted-foreground mt-1">
            <span>
              {remarks.trim().length < 5 && remarks.trim().length > 0 && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Minimum 5 characters required for Rejection
                </span>
              )}
            </span>
            <span>{remarks.length} / 500</span>
          </div>
        </div>

        <DialogFooter className="mt-3 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => handleReview('rejected')}
            disabled={isRejectDisabled}
          >
            {isLoading ? 'Rejecting...' : 'Reject Overtime'}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleReview('approved')}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isLoading ? 'Approving...' : 'Approve Overtime'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
