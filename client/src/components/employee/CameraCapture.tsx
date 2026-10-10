import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';

export interface CameraCaptureProps {
  onCapture: (imageBlob: Blob) => void;
  onCancel?: () => void;
  className?: string;
}

export type CameraErrorCode =
  | 'insecure_context'
  | 'not_allowed'
  | 'not_found'
  | 'not_readable'
  | 'unsupported'
  | 'unknown';

export interface CameraError {
  code: CameraErrorCode;
  message: string;
}

const ERROR_MESSAGES: Record<CameraErrorCode, string> = {
  insecure_context:
    'Camera access requires a secure connection (HTTPS or localhost).',
  not_allowed:
    'Camera permission was denied. Please allow camera access in your browser settings to take your attendance selfie.',
  not_found:
    'No camera hardware detected. Please connect a webcam or use a device with an integrated camera.',
  not_readable:
    'Camera is currently in use by another application or blocked by system permissions.',
  unsupported:
    'Camera access (getUserMedia) is not supported in this browser.',
  unknown: 'An unexpected error occurred while accessing the camera.',
};

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onCancel,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore errors stopping tracks
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setError(null);
    setCapturedBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError({
        code: 'insecure_context',
        message: ERROR_MESSAGES.insecure_context,
      });
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setError({
        code: 'unsupported',
        message: ERROR_MESSAGES.unsupported,
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // Autoplay might need user interaction or was interrupted
        }
      }
      setIsStreaming(true);
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      let code: CameraErrorCode = 'unknown';

      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        code = 'not_allowed';
      } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
        code = 'not_found';
      } else if (e?.name === 'NotReadableError' || e?.name === 'TrackStartError') {
        code = 'not_readable';
      }

      setError({
        code,
        message: ERROR_MESSAGES[code] || e?.message || 'An unexpected camera error occurred.',
      });
      setIsStreaming(false);
    }
  }, [stopStream, previewUrl]);

  useEffect(() => {
    let isCancelled = false;

    const initCamera = async () => {
      // Defer to microtask to prevent synchronous cascading render warning
      await Promise.resolve();
      if (isCancelled) return;

      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setError({
          code: 'insecure_context',
          message: ERROR_MESSAGES.insecure_context,
        });
        return;
      }

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setError({
          code: 'unsupported',
          message: ERROR_MESSAGES.unsupported,
        });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {
              // Ignore
            }
          });
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
        setIsStreaming(true);
      } catch (err: unknown) {
        if (isCancelled) return;
        const e = err as { name?: string; message?: string };
        let code: CameraErrorCode = 'unknown';

        if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
          code = 'not_allowed';
        } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
          code = 'not_found';
        } else if (e?.name === 'NotReadableError' || e?.name === 'TrackStartError') {
          code = 'not_readable';
        }

        setError({
          code,
          message: ERROR_MESSAGES[code] || e?.message || 'An unexpected camera error occurred.',
        });
        setIsStreaming(false);
      }
    };

    void initCamera();

    return () => {
      isCancelled = true;
      stopStream();
    };
  }, [stopStream]);


  const handleCapture = () => {
    if (!videoRef.current || !streamRef.current) return;
    setIsProcessing(true);

    const video = videoRef.current;
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;

    // Resize to max 720 px width per CLAUDE.md section 7
    const maxWidth = 720;
    let targetWidth = videoWidth;
    let targetHeight = videoHeight;

    if (targetWidth > maxWidth) {
      const ratio = maxWidth / targetWidth;
      targetWidth = maxWidth;
      targetHeight = Math.round(videoHeight * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setError({
        code: 'unknown',
        message: 'Could not create canvas graphics context for capture.',
      });
      setIsProcessing(false);
      return;
    }

    // Mirror horizontally to match the front-facing camera preview
    ctx.translate(targetWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    // Export to JPEG with quality 0.8 per CLAUDE.md section 7
    canvas.toBlob(
      (blob) => {
        setIsProcessing(false);
        if (blob) {
          stopStream();
          const objectUrl = URL.createObjectURL(blob);
          setCapturedBlob(blob);
          setPreviewUrl(objectUrl);
        } else {
          setError({
            code: 'unknown',
            message: 'Failed to generate JPEG image blob from camera capture.',
          });
        }
      },
      'image/jpeg',
      0.8
    );
  };

  const handleRetake = () => {
    setCapturedBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedBlob) {
      stopStream();
      onCapture(capturedBlob);
    }
  };

  return (
    <div
      className={`flex flex-col items-center gap-4 w-full max-w-md mx-auto ${className}`}
      data-testid="camera-capture-container"
    >
      {/* Live / Preview Frame */}
      <div className="relative w-full aspect-[4/3] bg-muted/60 dark:bg-muted/20 rounded-2xl overflow-hidden border border-border shadow-inner flex items-center justify-center">
        {/* Error Display */}
        {error ? (
          <div
            className="flex flex-col items-center justify-center p-6 text-center gap-3 text-destructive"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="w-10 h-10 stroke-[1.5]" />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">Camera Unavailable</h4>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                {error.message}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startCamera}
              className="mt-2 text-foreground"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry Permission
            </Button>
          </div>
        ) : previewUrl ? (
          /* Captured Snapshot Preview */
          <div className="relative w-full h-full">
            <img
              src={previewUrl}
              alt="Selfie snapshot preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3 bg-emerald-500/90 text-white text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Captured
            </div>
          </div>
        ) : (
          /* Live Stream */
          <div className="relative w-full h-full bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover -scale-x-100"
              aria-label="Live camera viewfinder"
            />
            {/* Face Guideline Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-60 border-2 border-dashed border-white/50 rounded-full flex items-center justify-center">
                <span className="text-[11px] text-white/70 bg-black/40 px-2 py-0.5 rounded-full font-medium">
                  Center Face Here
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center justify-center gap-3 w-full">
        {error ? (
          onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                stopStream();
                onCancel();
              }}
              className="w-full"
            >
              Cancel
            </Button>
          )
        ) : previewUrl ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleRetake}
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Retake
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleConfirm}
              className="flex-1"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Confirm Photo
            </Button>
          </>
        ) : (
          <>
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  stopStream();
                  onCancel();
                }}
                disabled={isProcessing}
              >
                Cancel
              </Button>
            )}
            <Button
              type="button"
              variant="default"
              size="lg"
              onClick={handleCapture}
              disabled={!isStreaming || isProcessing}
              className="flex-1 shadow-md"
            >
              <Camera className="w-4 h-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Take Selfie'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraCapture;
