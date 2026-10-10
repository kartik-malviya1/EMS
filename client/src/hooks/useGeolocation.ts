import { useState, useCallback } from 'react';

export type GeolocationErrorCode =
  | 'insecure_context'
  | 'unsupported'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'unknown';

export interface GeolocationStateError {
  code: GeolocationErrorCode;
  message: string;
}

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

const ERROR_MESSAGES: Record<GeolocationErrorCode, string> = {
  insecure_context:
    'Geolocation requires a secure connection (HTTPS or localhost).',
  unsupported: 'Geolocation is not supported by your browser.',
  permission_denied:
    'Location access was denied. Please allow location permissions in your browser to punch attendance.',
  position_unavailable:
    'Your physical location could not be determined. Please ensure GPS/location services are enabled.',
  timeout:
    'Location request timed out. Please check your GPS signal and try again.',
  unknown: 'An unexpected error occurred while obtaining your location.',
};

export function useGeolocation() {
  const [coords, setCoords] = useState<GeolocationCoordinates | null>(null);
  const [error, setError] = useState<GeolocationStateError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const clear = useCallback(() => {
    setCoords(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const getLocation = useCallback((): Promise<GeolocationCoordinates> => {
    setIsLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        const err: GeolocationStateError = {
          code: 'insecure_context',
          message: ERROR_MESSAGES.insecure_context,
        };
        setError(err);
        setIsLoading(false);
        return reject(new Error(err.message));
      }

      if (
        typeof navigator === 'undefined' ||
        !navigator.geolocation ||
        !navigator.geolocation.getCurrentPosition
      ) {
        const err: GeolocationStateError = {
          code: 'unsupported',
          message: ERROR_MESSAGES.unsupported,
        };
        setError(err);
        setIsLoading(false);
        return reject(new Error(err.message));
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const result: GeolocationCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setCoords(result);
          setError(null);
          setIsLoading(false);
          resolve(result);
        },
        (geoError) => {
          let code: GeolocationErrorCode = 'unknown';
          if (geoError.code === geoError.PERMISSION_DENIED) {
            code = 'permission_denied';
          } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
            code = 'position_unavailable';
          } else if (geoError.code === geoError.TIMEOUT) {
            code = 'timeout';
          }

          const stateError: GeolocationStateError = {
            code,
            message: geoError.message || ERROR_MESSAGES[code],
          };
          setError(stateError);
          setCoords(null);
          setIsLoading(false);
          reject(new Error(stateError.message));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  return {
    coords,
    error,
    isLoading,
    getLocation,
    clear,
  };
}

export default useGeolocation;
