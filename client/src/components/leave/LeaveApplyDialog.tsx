import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useApplyLeaveMutation } from '../../features/leave/leaveApi';
import type { LeaveType, HalfDayPeriod } from '../../types/models';
import { toast } from 'sonner';
import { CalendarPlus, Loader2, Calendar, Info } from 'lucide-react';
import { getApiErrorMessage } from '../../lib/utils';
import { DateTime } from 'luxon';

interface LeaveApplyDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export const LeaveApplyDialog: React.FC<LeaveApplyDialogProps> = ({
  trigger,
  onSuccess,
}) => {
  const [open, setOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<HalfDayPeriod>('first_half');
  const [reason, setReason] = useState('');

  const [applyLeave, { isLoading }] = useApplyLeaveMutation();

  // Compute estimated working days client-side for immediate user feedback
  const calculatedDays = useMemo(() => {
    if (!startDate) return 0;
    if (isHalfDay) return 0.5;
    if (!endDate) return 0;

    const start = DateTime.fromISO(startDate);
    const end = DateTime.fromISO(endDate);

    if (!start.isValid || !end.isValid || start > end) return 0;

    let count = 0;
    let curr = start;
    while (curr <= end) {
      if (curr.weekday >= 1 && curr.weekday <= 5) {
        count++;
      }
      curr = curr.plus({ days: 1 });
    }
    return count;
  }, [startDate, endDate, isHalfDay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate) {
      toast.error('Please select a start date');
      return;
    }

    const effectiveEndDate = isHalfDay ? startDate : endDate;

    if (!effectiveEndDate) {
      toast.error('Please select an end date');
      return;
    }

    if (reason.trim().length < 5) {
      toast.error('Please provide a reason of at least 5 characters');
      return;
    }

    if (calculatedDays === 0) {
      toast.error('Selected dates do not include any working days (weekdays)');
      return;
    }

    try {
      await applyLeave({
        leaveType,
        startDate,
        endDate: effectiveEndDate,
        isHalfDay,
        halfDayPeriod: isHalfDay ? halfDayPeriod : null,
        reason: reason.trim(),
      }).unwrap();

      toast.success('Leave application submitted successfully');
      setOpen(false);
      // Reset form
      setStartDate('');
      setEndDate('');
      setIsHalfDay(false);
      setReason('');
      onSuccess?.();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to submit leave application');
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-1.5 h-9 rounded-xl text-xs font-semibold shadow-xs">
            <CalendarPlus className="w-3.5 h-3.5" />
            <span>Apply for Leave</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px] p-6 rounded-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span>Apply for Leave</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Submit a workforce leave request for manager or administrator approval.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Leave Type */}
          <div className="space-y-1.5">
            <Label htmlFor="leaveType" className="text-xs font-semibold">
              Leave Category
            </Label>
            <select
              id="leaveType"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full h-9 rounded-xl border border-input bg-card px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20"
            >
              <option value="annual">Annual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="casual">Casual Leave</option>
              <option value="unpaid">Unpaid Leave</option>
            </select>
          </div>

          {/* Half Day Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isHalfDay"
              checked={isHalfDay}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsHalfDay(checked);
                if (checked && startDate) {
                  setEndDate(startDate);
                }
              }}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20"
            />
            <Label htmlFor="isHalfDay" className="text-xs font-medium cursor-pointer">
              Single-Date Half-Day Leave
            </Label>
          </div>

          {/* Date Range Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-xs font-semibold">
                {isHalfDay ? 'Date' : 'Start Date'}
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (isHalfDay) {
                    setEndDate(e.target.value);
                  }
                }}
                className="h-9 text-xs rounded-xl"
                required
              />
            </div>

            {!isHalfDay ? (
              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-xs font-semibold">
                  End Date
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                  required
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="halfDayPeriod" className="text-xs font-semibold">
                  Session
                </Label>
                <select
                  id="halfDayPeriod"
                  value={halfDayPeriod}
                  onChange={(e) => setHalfDayPeriod(e.target.value as HalfDayPeriod)}
                  className="w-full h-9 rounded-xl border border-input bg-card px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20"
                >
                  <option value="first_half">First Half (Morning)</option>
                  <option value="second_half">Second Half (Afternoon)</option>
                </select>
              </div>
            )}
          </div>

          {/* Working Days Calculated Preview */}
          {startDate && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/15 text-xs text-foreground">
              <Info className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                Calculated Working Duration:{' '}
                <strong className="text-primary font-bold">
                  {calculatedDays} {calculatedDays === 1 ? 'working day' : 'working days'}
                </strong>{' '}
                (weekends automatically excluded)
              </span>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs font-semibold">
              Reason for Absence
            </Label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide details for your leave request (minimum 5 characters)..."
              className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-hidden resize-none"
              required
            />
            <div className="text-[10px] text-muted-foreground text-right">
              {reason.length}/500 characters
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => setOpen(false)}
              className="h-8 text-xs rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !startDate || reason.trim().length < 5}
              className="h-8 text-xs rounded-lg font-semibold gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Request</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
