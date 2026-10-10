interface ServerErrorPayload {
  data?: {
    error?: {
      code?: string;
      message?: string;
      details?: unknown[];
    };
  };
  error?: string;
  message?: string;
}

export function formatAttendanceError(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return 'An unknown error occurred while submitting attendance.';
  }

  const payload = err as ServerErrorPayload;
  const errorObj = payload.data?.error;
  const code = errorObj?.code;
  const serverMsg = errorObj?.message;

  if (code) {
    switch (code) {
      case 'OUTSIDE_GEOFENCE':
        return (
          serverMsg ||
          'You are outside the designated office radius. Please move closer to the office location.'
        );
      case 'LOW_LOCATION_ACCURACY':
        return (
          serverMsg ||
          'Location accuracy is too low. Please ensure GPS is enabled in high accuracy mode.'
        );
      case 'ALREADY_PUNCHED_IN':
        return "You have already punched in for today's shift.";
      case 'NO_OPEN_ATTENDANCE':
        return 'No active shift found to punch out from.';
      case 'FILE_TOO_LARGE':
        return 'The selfie file size is too large (maximum allowed is 2 MB).';
      case 'UNSUPPORTED_MEDIA_TYPE':
        return 'Unsupported image format. Please capture a new selfie.';
      case 'OVERTIME_NOT_REQUESTABLE':
        return (
          serverMsg ||
          'Overtime is not requestable for this shift (shift must be completed, > 8 hours, and valid).'
        );
      case 'ATTENDANCE_INVALID':
        return 'This attendance record was marked invalid.';
      case 'ADMIN_NOT_ELIGIBLE':
        return (
          serverMsg ||
          'Administrators are administrative-only and not eligible for workforce attendance actions.'
        );
      case 'STORAGE_UNAVAILABLE':
        return (
          serverMsg ||
          'Selfie storage service is temporarily unavailable. Please try again.'
        );
      case 'OPEN_SHIFT':
        return (
          serverMsg ||
          'Cannot modify user status while they have an active in-progress shift.'
        );
      case 'RATE_LIMITED':
        return 'Too many punch requests in a short period. Please wait a few minutes and try again.';
      default:
        if (serverMsg) return serverMsg;
    }
  }

  if (payload.message) return payload.message;
  if (payload.error) return payload.error;

  return 'Failed to record attendance. Please check your network and try again.';
}
