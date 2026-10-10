import React, { useState, useEffect, useMemo } from 'react';
import {
  LogIn,
  LogOut,
  Clock,
  MapPin,
  CheckCircle2,
  Calendar,
  Timer,
  Info,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { DateTime } from 'luxon';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { StatusBadge } from '../common/StatusBadge';
import { CameraCapture } from './CameraCapture';
import { useGeolocation } from '../../hooks/useGeolocation';
import {
  usePunchInMutation,
  usePunchOutMutation,
} from '../../features/attendance/attendanceApi';
import { formatAttendanceError } from '../../features/attendance/attendanceError';
import type { Attendance, WorkingStatus } from '../../types/models';

interface PunchCardProps {
  todayAttendance: Attendance | null | undefined;
  isLoading?: boolean;
  onRequestOvertime?: (attendance: Attendance) => void;
}

export const PunchCard: React.FC<PunchCardProps> = ({
  todayAttendance,
  isLoading = false,
  onRequestOvertime,
}) => {
  const [currentTime, setCurrentTime] = useState<DateTime>(DateTime.now());
  const [activePunchModal, setActivePunchModal] = useState<
    'punch-in' | 'punch-out' | null
  >(null);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);

  const {
    coords,
    error: geoError,
    isLoading: geoLoading,
    getLocation,
    clear: clearGeo,
  } = useGeolocation();

  const [punchIn, { isLoading: isPunchingIn }] = usePunchInMutation();
  const [punchOut, { isLoading: isPunchingOut }] = usePunchOutMutation();

  // Current real-time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(DateTime.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute live elapsed timer from server punchIn.at when in_progress
  const elapsedDuration = useMemo(() => {
    if (
      todayAttendance &&
      todayAttendance.workingStatus === 'in_progress' &&
      todayAttendance.punchIn?.at
    ) {
      const punchInInstant = DateTime.fromISO(todayAttendance.punchIn.at);
      const diff = currentTime.diff(punchInInstant, ['hours', 'minutes', 'seconds']);
      const hours = String(Math.max(0, Math.floor(diff.hours))).padStart(2, '0');
      const minutes = String(Math.max(0, Math.floor(diff.minutes))).padStart(2, '0');
      const seconds = String(Math.max(0, Math.floor(diff.seconds))).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }
    return '00:00:00';
  }, [currentTime, todayAttendance]);

  // Determine working state
  const workingStatus: WorkingStatus | 'not_punched' = todayAttendance
    ? todayAttendance.workingStatus
    : 'not_punched';

  const isPunchInEnabled = workingStatus === 'not_punched' && !isLoading;
  const isPunchOutEnabled = workingStatus === 'in_progress' && !isLoading;

  const openPunchModal = (type: 'punch-in' | 'punch-out') => {
    setSelfieBlob(null);
    clearGeo();
    setActivePunchModal(type);
    // Request location proactively
    getLocation().catch(() => {
      // Handled by hook error state
    });
  };

  const closePunchModal = () => {
    setActivePunchModal(null);
    setSelfieBlob(null);
    clearGeo();
  };

  const handleCaptureSelfie = (blob: Blob) => {
    setSelfieBlob(blob);
  };

  const handleSubmitPunch = async () => {
    if (!selfieBlob) {
      toast.error('Please take and confirm your selfie first.');
      return;
    }

    let currentCoords = coords;
    if (!currentCoords) {
      try {
        currentCoords = await getLocation();
      } catch (err: unknown) {
        const error = err as Error;
        toast.error(error.message || 'Location acquisition failed.');
        return;
      }
    }

    const formData = new FormData();
    formData.append('selfie', selfieBlob, 'selfie.jpg');
    formData.append('latitude', String(currentCoords.latitude));
    formData.append('longitude', String(currentCoords.longitude));
    formData.append('accuracy', String(currentCoords.accuracy));

    try {
      if (activePunchModal === 'punch-in') {
        await punchIn(formData).unwrap();
        toast.success("Successfully punched in! Have a great day at work.");
      } else if (activePunchModal === 'punch-out') {
        const res = await punchOut(formData).unwrap();
        const minutes = res.workedMinutes ?? 0;
        const hours = (minutes / 60).toFixed(1);
        toast.success(
          `Successfully punched out! Total shift worked: ${hours} hrs (${minutes} mins).`
        );
      }
      closePunchModal();
    } catch (err: unknown) {
      const errorMsg = formatAttendanceError(err);
      toast.error(errorMsg);
    }
  };

  // Format punch times for display
  const punchInTimeFormatted = todayAttendance?.punchIn?.at
    ? DateTime.fromISO(todayAttendance.punchIn.at).toFormat('hh:mm a')
    : '--:--';

  const punchOutTimeFormatted = todayAttendance?.punchOut?.at
    ? DateTime.fromISO(todayAttendance.punchOut.at).toFormat('hh:mm a')
    : '--:--';

  const isSubmitting = isPunchingIn || isPunchingOut;

  // Calculate standard 8-hour shift completion percentage
  let progressPercentage = 0;
  if (todayAttendance?.workingStatus === 'completed') {
    progressPercentage = 100;
  } else if (todayAttendance?.workingStatus === 'in_progress' && todayAttendance.punchIn?.at) {
    const elapsedMinutes = Math.max(
      0,
      Math.floor(
        DateTime.now().diff(DateTime.fromISO(todayAttendance.punchIn.at), 'minutes').minutes
      )
    );
    progressPercentage = Math.min(100, Math.round((elapsedMinutes / 480) * 100));
  } else if (todayAttendance?.workedMinutes) {
    progressPercentage = Math.min(100, Math.round((todayAttendance.workedMinutes / 480) * 100));
  }

  return (
    <Card className="overflow-hidden border-border/80 shadow-md bg-gradient-to-br from-card via-card to-muted/20">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{currentTime.toFormat('cccc, dd MMMM yyyy')}</span>
            </div>
            <CardTitle className="text-xl font-bold tracking-tight">
              Today's Attendance
            </CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Current Time</span>
              <span className="font-mono text-base font-semibold">
                {currentTime.toFormat('hh:mm:ss a')}
              </span>
            </div>
            {workingStatus === 'not_punched' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground border border-border">
                <Info className="w-3.5 h-3.5" />
                Not Punched In
              </span>
            ) : (
              <StatusBadge type="working" status={workingStatus} />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Metric Overview Panels */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Punch In Info */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Punch In Time</span>
              <LogIn className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono tracking-tight text-foreground">
                {punchInTimeFormatted}
              </div>
              {todayAttendance?.punchIn?.location && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1 truncate">
                  <MapPin className="w-3 h-3 flex-shrink-0 text-emerald-500" />
                  <span>
                    Acc: {Math.round(todayAttendance.punchIn.location.accuracy)}m
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Punch Out Info */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Punch Out Time</span>
              <LogOut className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono tracking-tight text-foreground">
                {punchOutTimeFormatted}
              </div>
              {todayAttendance?.punchOut?.location && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1 truncate">
                  <MapPin className="w-3 h-3 flex-shrink-0 text-amber-500" />
                  <span>
                    Acc: {Math.round(todayAttendance.punchOut.location.accuracy)}m
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Duration / Live Timer */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>
                {workingStatus === 'in_progress' ? 'Elapsed Time' : 'Worked Hours'}
              </span>
              <Timer
                className={`w-4 h-4 ${
                  workingStatus === 'in_progress'
                    ? 'text-primary animate-spin'
                    : 'text-muted-foreground'
                }`}
              />
            </div>
            <div>
              <div className="text-xl font-bold font-mono tracking-tight text-foreground">
                {workingStatus === 'in_progress' ? (
                  <span className="text-primary font-semibold">{elapsedDuration}</span>
                ) : todayAttendance?.workedMinutes !== undefined &&
                  todayAttendance.workedMinutes !== null ? (
                  `${Math.floor(todayAttendance.workedMinutes / 60)}h ${
                    todayAttendance.workedMinutes % 60
                  }m`
                ) : (
                  '0h 0m'
                )}
              </div>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Standard: 8h shift (480m)
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar towards standard shift */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Shift Target (8 hours)</span>
            <span className="font-semibold">{progressPercentage}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                progressPercentage >= 100 ? 'bg-emerald-500' : 'bg-primary'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Verification & Overtime Status Banner if punch-out is completed */}
        {todayAttendance && todayAttendance.workingStatus !== 'in_progress' && (
          <div className="p-4 rounded-xl bg-muted/20 border border-border/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Verification:</span>
                <StatusBadge
                  type="verification"
                  status={todayAttendance.verification?.status}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Overtime:</span>
                <StatusBadge
                  type="overtime"
                  status={todayAttendance.overtime?.status}
                />
              </div>
              {todayAttendance.verification?.remarks && (
                <div className="text-xs text-muted-foreground italic">
                  Note: "{todayAttendance.verification.remarks}"
                </div>
              )}
            </div>

            {/* Overtime Request CTA if eligible */}
            {onRequestOvertime &&
              todayAttendance.workingStatus === 'completed' &&
              (todayAttendance.workedMinutes ?? 0) > 480 &&
              todayAttendance.verification?.status !== 'invalid' &&
              (todayAttendance.overtime?.status === 'not_requested' ||
                todayAttendance.overtime?.status === 'rejected' ||
                !todayAttendance.overtime?.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRequestOvertime(todayAttendance)}
                  className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  Request Overtime ({todayAttendance.workedMinutes! - 480} mins)
                </Button>
              )}
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Button
            data-testid="punch-in-button"
            type="button"
            size="lg"
            variant="default"
            disabled={!isPunchInEnabled || isSubmitting}
            onClick={() => openPunchModal('punch-in')}
            className="w-full sm:flex-1 h-12 text-sm font-semibold shadow-sm gap-2"
          >
            <LogIn className="w-4 h-4" />
            Punch In
          </Button>

          <Button
            data-testid="punch-out-button"
            type="button"
            size="lg"
            variant="outline"
            disabled={!isPunchOutEnabled || isSubmitting}
            onClick={() => openPunchModal('punch-out')}
            className={`w-full sm:flex-1 h-12 text-sm font-semibold border-2 gap-2 ${
              isPunchOutEnabled
                ? 'border-amber-500/80 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                : ''
            }`}
          >
            <LogOut className="w-4 h-4" />
            Punch Out
          </Button>
        </div>
      </CardContent>

      {/* Punch Action Modal (Geolocation + Selfie Capture) */}
      <Dialog
        open={Boolean(activePunchModal)}
        onOpenChange={(open) => {
          if (!open) closePunchModal();
        }}
      >
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              {activePunchModal === 'punch-in' ? (
                <>
                  <LogIn className="w-5 h-5 text-emerald-500" />
                  Record Punch In
                </>
              ) : (
                <>
                  <LogOut className="w-5 h-5 text-amber-500" />
                  Record Punch Out
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Geolocation Feedback Banner */}
            <div
              className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
                geoError
                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                  : coords
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-muted/50 text-muted-foreground border-border'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>
                  {geoLoading
                    ? 'Acquiring GPS satellite position...'
                    : geoError
                      ? geoError.message
                      : coords
                        ? `GPS Locked: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                        : 'Waiting for location...'}
                </span>
              </div>
              {geoError && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={getLocation}
                  className="h-7 text-[11px] px-2.5 ml-2"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry GPS
                </Button>
              )}
              {coords && (
                <span className="font-mono text-[11px] font-semibold bg-background px-2 py-0.5 rounded border border-border">
                  ±{Math.round(coords.accuracy)}m
                </span>
              )}
            </div>

            {/* In-browser Camera Capture */}
            <CameraCapture
              onCapture={handleCaptureSelfie}
              onCancel={closePunchModal}
            />

            {/* Confirm Submit Action when photo is captured */}
            {selfieBlob && (
              <div className="pt-2">
                <Button
                  type="button"
                  size="lg"
                  variant="default"
                  disabled={
                    isSubmitting ||
                    isPunchingIn ||
                    isPunchingOut ||
                    geoLoading ||
                    Boolean(geoError) ||
                    !coords
                  }
                  onClick={handleSubmitPunch}
                  className="w-full h-11 text-sm font-semibold shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {isSubmitting || isPunchingIn || isPunchingOut
                    ? 'Verifying and Submitting...'
                    : activePunchModal === 'punch-in'
                      ? 'Submit Punch In'
                      : 'Submit Punch Out'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PunchCard;
