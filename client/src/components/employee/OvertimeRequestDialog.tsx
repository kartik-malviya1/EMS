import React, { useState } from 'react';
import { Clock, AlertCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useRequestOvertimeMutation } from '../../features/attendance/attendanceApi';
import { formatAttendanceError } from '../../features/attendance/attendanceError';
import type { Attendance } from '../../types/models';

interface OvertimeRequestDialogProps {
  attendance: Attendance | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OvertimeRequestDialog: React.FC<OvertimeRequestDialogProps> = ({
  attendance,
  isOpen,
  onClose,
}) => {
  const workedMinutes = attendance?.workedMinutes ?? 0;
  const maxMinutes = Math.max(0, workedMinutes - 480);

  const [requestedMinutes, setRequestedMinutes] = useState<number>(
    Math.min(60, maxMinutes > 0 ? maxMinutes : 60)
  );
  const [reason, setReason] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [requestOvertime, { isLoading }] = useRequestOvertimeMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendance) return;

    if (!requestedMinutes || requestedMinutes < 1) {
      setValidationError('Requested minutes must be at least 1 minute.');
      return;
    }

    if (requestedMinutes > maxMinutes) {
      setValidationError(
        `Requested minutes cannot exceed the maximum overtime worked (${maxMinutes} minutes).`
      );
      return;
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5) {
      setValidationError('Please enter a descriptive reason of at least 5 characters.');
      return;
    }

    if (trimmedReason.length > 500) {
      setValidationError('Reason cannot exceed 500 characters.');
      return;
    }

    setValidationError(null);

    try {
      await requestOvertime({
        id: attendance.id || attendance._id!,
        requestedMinutes: Number(requestedMinutes),
        reason: trimmedReason,
      }).unwrap();

      toast.success(
        `Overtime request for ${requestedMinutes} minutes submitted successfully.`
      );
      onClose();
    } catch (err: unknown) {
      const errorMsg = formatAttendanceError(err);
      toast.error(errorMsg);
    }
  };

  if (!attendance) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Request Overtime
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Submit overtime hours for shift on{' '}
            <span className="font-semibold text-foreground">
              {attendance.workDate}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Shift Details Summary */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border border-border/60 text-xs">
            <div>
              <span className="text-muted-foreground block">Total Worked Time:</span>
              <span className="font-mono font-semibold text-foreground">
                {Math.floor(workedMinutes / 60)}h {workedMinutes % 60}m ({workedMinutes} mins)
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Max Overtime Available:</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {Math.floor(maxMinutes / 60)}h {maxMinutes % 60}m ({maxMinutes} mins)
              </span>
            </div>
          </div>

          {/* Previous Rejection note if resubmitting */}
          {attendance.overtime?.status === 'rejected' && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
              <span className="font-semibold block">Previous Request Rejected</span>
              {attendance.overtime.remarks && (
                <p className="mt-0.5 italic">"{attendance.overtime.remarks}"</p>
              )}
              <span className="text-[11px] text-muted-foreground block mt-1">
                You may submit an updated request with corrected details.
              </span>
            </div>
          )}

          {/* Requested Minutes Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="requested-minutes" className="text-xs font-semibold">
                Overtime Duration (Minutes)
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Range: 1 – {maxMinutes} mins
              </span>
            </div>
            <div className="relative">
              <Input
                id="requested-minutes"
                type="number"
                min={1}
                max={maxMinutes}
                value={requestedMinutes}
                onChange={(e) => {
                  setRequestedMinutes(Number(e.target.value));
                  setValidationError(null);
                }}
                className="font-mono pr-12"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none">
                min
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Equivalent to: {(requestedMinutes / 60).toFixed(2)} hours
            </p>
          </div>

          {/* Reason Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="overtime-reason" className="text-xs font-semibold">
                Reason for Overtime
              </Label>
              <span
                className={`text-[11px] ${
                  reason.length > 500 ? 'text-destructive font-semibold' : 'text-muted-foreground'
                }`}
              >
                {reason.length} / 500
              </span>
            </div>
            <textarea
              id="overtime-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setValidationError(null);
              }}
              placeholder="e.g. Critical production release deployment and system monitoring."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              required
            />
          </div>

          {/* Error Message */}
          {validationError && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || maxMinutes <= 0}
              className="gap-1.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OvertimeRequestDialog;
