import React, { useState } from 'react';
import { getBaseUrl } from '../../features/api/apiSlice';
import { Camera, MapPin, Clock, ExternalLink } from 'lucide-react';
import { DateTime } from 'luxon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import type { Attendance } from '../../types/models';

interface SelfiePreviewDialogProps {
  attendance: Attendance | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SelfiePreviewDialog: React.FC<SelfiePreviewDialogProps> = ({
  attendance,
  isOpen,
  onClose,
}) => {
  const [punchInImgError, setPunchInImgError] = useState(false);
  const [punchOutImgError, setPunchOutImgError] = useState(false);

  if (!attendance) return null;

  const attendanceId = attendance.id || attendance._id;
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('ems_token') : null;
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  const punchInSelfieUrl = `${getBaseUrl()}/attendance/${attendanceId}/selfies/punch-in${tokenParam}`;
  const punchOutSelfieUrl = `${getBaseUrl()}/attendance/${attendanceId}/selfies/punch-out${tokenParam}`;

  const formatCoords = (lat?: number, lng?: number) => {
    if (lat === undefined || lng === undefined) return null;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  const mapsUrl = (lat?: number, lng?: number) => {
    if (lat === undefined || lng === undefined) return '#';
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Attendance Selfies — {attendance.workDate}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Punch In Selfie */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                Punch In
              </span>
              <span className="text-xs font-mono font-medium">
                {attendance.punchIn?.at
                  ? DateTime.fromISO(attendance.punchIn.at).toFormat('hh:mm a')
                  : '--:--'}
              </span>
            </div>

            <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-black/5 dark:bg-black/30 border border-border flex items-center justify-center">
              {punchInImgError ? (
                <div className="text-center p-4 text-xs text-muted-foreground space-y-1">
                  <Camera className="w-8 h-8 mx-auto stroke-1 opacity-50" />
                  <p>Selfie not available or not captured</p>
                </div>
              ) : (
                <img
                  src={punchInSelfieUrl}
                  crossOrigin="use-credentials"
                  alt="Punch In Selfie"
                  className="w-full h-full object-cover"
                  onError={() => setPunchInImgError(true)}
                />
              )}
            </div>

            {attendance.punchIn?.location && (
              <div className="text-xs space-y-1 text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    {formatCoords(
                      attendance.punchIn.location.latitude,
                      attendance.punchIn.location.longitude
                    )}
                  </span>
                  <a
                    href={mapsUrl(
                      attendance.punchIn.location.latitude,
                      attendance.punchIn.location.longitude
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    Maps <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="text-[11px]">
                  Accuracy: ±{Math.round(attendance.punchIn.location.accuracy)}m
                </div>
              </div>
            )}
          </div>

          {/* Punch Out Selfie */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Punch Out
              </span>
              <span className="text-xs font-mono font-medium">
                {attendance.punchOut?.at
                  ? DateTime.fromISO(attendance.punchOut.at).toFormat('hh:mm a')
                  : '--:--'}
              </span>
            </div>

            <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-black/5 dark:bg-black/30 border border-border flex items-center justify-center">
              {!attendance.punchOut ? (
                <div className="text-center p-4 text-xs text-muted-foreground space-y-1">
                  <Clock className="w-8 h-8 mx-auto stroke-1 opacity-50" />
                  <p>Shift currently open or not punched out</p>
                </div>
              ) : punchOutImgError ? (
                <div className="text-center p-4 text-xs text-muted-foreground space-y-1">
                  <Camera className="w-8 h-8 mx-auto stroke-1 opacity-50" />
                  <p>Selfie not available or not captured</p>
                </div>
              ) : (
                <img
                  src={punchOutSelfieUrl}
                  crossOrigin="use-credentials"
                  alt="Punch Out Selfie"
                  className="w-full h-full object-cover"
                  onError={() => setPunchOutImgError(true)}
                />
              )}
            </div>

            {attendance.punchOut?.location && (
              <div className="text-xs space-y-1 text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    {formatCoords(
                      attendance.punchOut.location.latitude,
                      attendance.punchOut.location.longitude
                    )}
                  </span>
                  <a
                    href={mapsUrl(
                      attendance.punchOut.location.latitude,
                      attendance.punchOut.location.longitude
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    Maps <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="text-[11px]">
                  Accuracy: ±{Math.round(attendance.punchOut.location.accuracy)}m
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SelfiePreviewDialog;
