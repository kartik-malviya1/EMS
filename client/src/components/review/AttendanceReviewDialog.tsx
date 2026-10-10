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
import {
  MapPin,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Clock,
  History,
  AlertCircle,
  Camera,
} from 'lucide-react';
import { useReviewVerificationMutation } from '../../features/attendance/attendanceApi';
import type { Attendance, User } from '../../types/models';
import { toast } from 'sonner';

interface AttendanceReviewDialogProps {
  attendance: Attendance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const AttendanceReviewDialog: React.FC<AttendanceReviewDialogProps> = ({
  attendance,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [remarks, setRemarks] = useState('');
  const [reviewVerification, { isLoading }] = useReviewVerificationMutation();

  if (!attendance) return null;

  const attendanceId = attendance.id || attendance._id || '';
  const employee =
    typeof attendance.employeeId === 'object' && attendance.employeeId !== null
      ? (attendance.employeeId as User)
      : null;
  const employeeName = employee?.name || 'Employee';
  const employeeEmail = employee?.email || '';

  const punchInLoc = attendance.punchIn?.location;
  const punchOutLoc = attendance.punchOut?.location;

  const handleReview = async (status: 'valid' | 'invalid') => {
    if (status === 'invalid' && remarks.trim().length < 5) {
      toast.error('Remarks must be at least 5 characters when marking Invalid.');
      return;
    }

    try {
      await reviewVerification({
        id: attendanceId,
        status,
        remarks: remarks.trim() || undefined,
      }).unwrap();

      toast.success(
        `Attendance marked as ${status === 'valid' ? 'Valid' : 'Invalid'}`
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
        'Failed to submit verification review';
      toast.error(message);
    }
  };

  const isInvalidDisabled = isLoading || remarks.trim().length < 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <DialogTitle className="text-xl font-bold">
                Verification Review: {employeeName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {employeeEmail} • Work Date: {attendance.workDate}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge
                kind="working"
                status={attendance.workingStatus}
                size="sm"
              />
              <StatusBadge
                kind="verification"
                status={attendance.verification?.status || 'pending'}
                size="sm"
              />
            </div>
          </div>
        </DialogHeader>

        {/* Selfies & Geolocation Side-by-Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {/* Punch-In Card */}
          <div className="border border-border/80 rounded-xl p-3 bg-muted/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/60">
                <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Punch-In Details
                </span>
                <span className="text-xs font-medium text-foreground">
                  {attendance.punchIn?.at
                    ? new Date(attendance.punchIn.at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A'}
                </span>
              </div>

              {/* Punch-In Photo */}
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted/60 relative border border-border/60 flex items-center justify-center mb-3">
                <img
                  src={`/api/attendance/${attendanceId}/selfies/punch-in`}
                  alt="Punch-in selfie"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const placeholder = document.createElement('div');
                      placeholder.className =
                        'flex flex-col items-center justify-center text-muted-foreground text-xs p-4 text-center';
                      placeholder.innerHTML =
                        '<span class="mb-1 text-sm font-semibold">Selfie Preview</span><span>Image unavailable or secure view</span>';
                      parent.appendChild(placeholder);
                    }
                  }}
                />
              </div>

              {/* Punch-In Geolocation */}
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> Coordinates:
                  </span>
                  <span className="font-mono text-foreground font-medium">
                    {punchInLoc
                      ? `${punchInLoc.latitude.toFixed(4)}, ${punchInLoc.longitude.toFixed(4)}`
                      : 'N/A'}
                  </span>
                </div>
                {punchInLoc?.distanceFromOfficeMeters !== undefined && (
                  <div className="flex items-center justify-between">
                    <span>Office Distance:</span>
                    <span className="font-semibold text-foreground">
                      {punchInLoc.distanceFromOfficeMeters} m
                    </span>
                  </div>
                )}
                {punchInLoc?.withinGeofence !== undefined && (
                  <div className="flex items-center justify-between">
                    <span>Geofence Status:</span>
                    <span
                      className={`font-semibold inline-flex items-center gap-1 ${
                        punchInLoc.withinGeofence
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {punchInLoc.withinGeofence ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" /> Inside
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-3.5 h-3.5" /> Outside
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {punchInLoc && (
              <a
                href={`https://www.google.com/maps?q=${punchInLoc.latitude},${punchInLoc.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center justify-center gap-1 text-xs text-primary font-semibold hover:underline border border-primary/20 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                Open Location in Maps <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

            {/* Punch-Out Card */}
          <div className="border border-border/80 rounded-xl p-3 bg-muted/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/60">
                <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Punch-Out Details
                </span>
                <span className="text-xs font-medium text-foreground">
                  {attendance.punchOut?.at
                    ? new Date(attendance.punchOut.at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Pending / Not Recorded'}
                </span>
              </div>

              {/* Punch-Out Photo */}
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted/60 relative border border-border/60 flex items-center justify-center mb-3">
                {attendance.punchOut ? (
                  <img
                    src={`/api/attendance/${attendanceId}/selfies/punch-out`}
                    alt="Punch-out selfie"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const placeholder = document.createElement('div');
                        placeholder.className =
                          'flex flex-col items-center justify-center text-muted-foreground text-xs p-4 text-center';
                        placeholder.innerHTML =
                          '<span class="mb-1 text-sm font-semibold">Selfie Preview</span><span>Image unavailable or secure view</span>';
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground text-xs p-4 text-center">
                    <Camera className="w-6 h-6 mb-1 opacity-40" />
                    <span>No punch-out selfie recorded</span>
                  </div>
                )}
              </div>

              {/* Punch-Out Geolocation */}
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> Coordinates:
                  </span>
                  <span className="font-mono text-foreground font-medium">
                    {punchOutLoc
                      ? `${punchOutLoc.latitude.toFixed(4)}, ${punchOutLoc.longitude.toFixed(4)}`
                      : 'N/A'}
                  </span>
                </div>
                {punchOutLoc?.distanceFromOfficeMeters !== undefined && (
                  <div className="flex items-center justify-between">
                    <span>Office Distance:</span>
                    <span className="font-semibold text-foreground">
                      {punchOutLoc.distanceFromOfficeMeters} m
                    </span>
                  </div>
                )}
                {punchOutLoc?.withinGeofence !== undefined && (
                  <div className="flex items-center justify-between">
                    <span>Geofence Status:</span>
                    <span
                      className={`font-semibold inline-flex items-center gap-1 ${
                        punchOutLoc.withinGeofence
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {punchOutLoc.withinGeofence ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" /> Inside
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-3.5 h-3.5" /> Outside
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {punchOutLoc ? (
              <a
                href={`https://www.google.com/maps?q=${punchOutLoc.latitude},${punchOutLoc.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center justify-center gap-1 text-xs text-primary font-semibold hover:underline border border-primary/20 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                Open Location in Maps <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <div className="mt-3 py-1.5 text-center text-xs text-muted-foreground/60 italic">
                Awaiting Punch-Out
              </div>
            )}
          </div>
        </div>

        {/* Shift Duration & Worked Hours */}
        <div className="mt-3 p-3 rounded-xl border border-border/80 bg-background flex items-center justify-between text-xs">
          <div>
            <span className="text-muted-foreground">Total Worked Duration: </span>
            <span className="font-bold text-foreground">
              {attendance.workedMinutes != null
                ? `${attendance.workedMinutes} mins (${(attendance.workedMinutes / 60).toFixed(2)} hrs)`
                : 'In Progress'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Standard Shift: </span>
            <span className="font-semibold text-foreground">480 mins (8.00 hrs)</span>
          </div>
        </div>

        {/* Audit History */}
        {attendance.verification?.history &&
          attendance.verification.history.length > 0 && (
            <div className="mt-4 border-t border-border/60 pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                <History className="w-3.5 h-3.5" /> Previous Review History (
                {attendance.verification.history.length})
              </h4>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {attendance.verification.history.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-border/60 bg-muted/30 text-xs flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge
                          kind="verification"
                          status={item.status}
                          size="sm"
                        />
                        <span className="text-muted-foreground text-[11px]">
                          {item.reviewedAt
                            ? new Date(item.reviewedAt).toLocaleString()
                            : ''}
                        </span>
                      </div>
                      <p className="text-muted-foreground italic">
                        &quot;{item.remarks || 'No remarks provided'}&quot;
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Review Form */}
        <div className="mt-4 border-t border-border/60 pt-3">
          <label className="block text-xs font-semibold mb-1 text-foreground">
            Review Remarks{' '}
            <span className="text-destructive font-normal">
              (required for Invalid, min 5 chars)
            </span>
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Provide context or explanation for your review decision..."
            className="w-full text-xs rounded-xl border border-input bg-background p-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          />
          <div className="flex justify-between items-center text-[11px] text-muted-foreground mt-1">
            <span>
              {remarks.trim().length < 5 && remarks.trim().length > 0 && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Minimum 5 characters required for Invalid
                </span>
              )}
            </span>
            <span>{remarks.length} / 500</span>
          </div>
        </div>

        <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2">
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
            onClick={() => handleReview('invalid')}
            disabled={isInvalidDisabled}
          >
            {isLoading ? 'Submitting...' : 'Mark as Invalid'}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleReview('valid')}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isLoading ? 'Submitting...' : 'Mark as Valid'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
