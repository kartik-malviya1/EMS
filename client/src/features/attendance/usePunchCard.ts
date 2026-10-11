import { useState, useEffect, useMemo, useCallback } from 'react';
import { DateTime } from 'luxon';
import { toast } from 'sonner';
import { useGeolocation } from '../../hooks/useGeolocation';
import {
  usePunchInMutation,
  usePunchOutMutation,
} from './attendanceApi';
import { formatAttendanceError } from './attendanceError';
import type { Attendance, WorkingStatus } from '../../types/models';

export interface UsePunchCardProps {
  todayAttendance: Attendance | null | undefined;
  isLoading?: boolean;
}

export function usePunchCard({ todayAttendance, isLoading = false }: UsePunchCardProps) {
  const [currentTime, setCurrentTime] = useState<DateTime>(() => DateTime.now());
  const [activePunchModal, setActivePunchModal] = useState<'punch-in' | 'punch-out' | null>(null);
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

  // 1-second live clock update
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
  const isSubmitting = isPunchingIn || isPunchingOut;

  const openPunchModal = useCallback((type: 'punch-in' | 'punch-out') => {
    setSelfieBlob(null);
    clearGeo();
    setActivePunchModal(type);
    getLocation().catch(() => {});
  }, [clearGeo, getLocation]);

  const closePunchModal = useCallback(() => {
    setActivePunchModal(null);
    setSelfieBlob(null);
    clearGeo();
  }, [clearGeo]);

  const handleCaptureSelfie = useCallback((blob: Blob) => {
    setSelfieBlob(blob);
  }, []);

  const handleSubmitPunch = useCallback(async () => {
    if (!selfieBlob) {
      toast.error('Please capture your selfie photo first.');
      return;
    }

    let currentCoords = coords;
    if (!currentCoords) {
      try {
        currentCoords = await getLocation();
      } catch (err: unknown) {
        const error = err as Error;
        toast.error(error.message || 'GPS location acquisition failed.');
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
        toast.success('Successfully punched in! Have a great day at work.');
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
  }, [selfieBlob, coords, getLocation, activePunchModal, punchIn, punchOut, closePunchModal]);

  // Formatted punch times
  const punchInTimeFormatted = todayAttendance?.punchIn?.at
    ? DateTime.fromISO(todayAttendance.punchIn.at).toFormat('hh:mm a')
    : '--:--';

  const punchOutTimeFormatted = todayAttendance?.punchOut?.at
    ? DateTime.fromISO(todayAttendance.punchOut.at).toFormat('hh:mm a')
    : '--:--';

  // 8-hour workday progress percentage
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

  return {
    currentTime,
    workingStatus,
    activePunchModal,
    selfieBlob,
    coords,
    geoError,
    geoLoading,
    getLocation,
    isPunchInEnabled,
    isPunchOutEnabled,
    isSubmitting,
    isPunchingIn,
    isPunchingOut,
    punchInTimeFormatted,
    punchOutTimeFormatted,
    elapsedDuration,
    progressPercentage,
    openPunchModal,
    closePunchModal,
    handleCaptureSelfie,
    handleSubmitPunch,
  };
}
