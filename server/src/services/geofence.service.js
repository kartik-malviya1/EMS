/**
 * Calculates the Haversine distance between two coordinates in meters.
 */
export const calculateHaversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Validates whether location is within geofence and meets accuracy criteria.
 * Throws ApiError if geofence is enabled and location is invalid.
 */
export const evaluateGeofence = ({
  latitude,
  longitude,
  accuracy,
  settings,
}) => {
  if (!settings || !settings.enabled) {
    return {
      distanceFromOfficeMeters: null,
      withinGeofence: null,
    };
  }

  // Check accuracy
  const maxAccuracy = settings.maxAccuracyMeters || 100;
  if (accuracy > maxAccuracy) {
    const error = new Error('Location accuracy too low');
    error.statusCode = 422;
    error.code = 'LOW_LOCATION_ACCURACY';
    error.details = { accuracy, maxAccuracyMeters: maxAccuracy };
    throw error;
  }

  // Calculate distance
  const distanceMeters = calculateHaversineDistanceMeters(
    latitude,
    longitude,
    settings.officeLatitude,
    settings.officeLongitude
  );

  const radiusMeters = settings.radiusMeters || 200;
  const withinGeofence = distanceMeters <= radiusMeters;

  if (!withinGeofence) {
    const error = new Error('Punch location is outside allowed office geofence');
    error.statusCode = 422;
    error.code = 'OUTSIDE_GEOFENCE';
    error.details = { distanceMeters, radiusMeters };
    throw error;
  }

  return {
    distanceFromOfficeMeters: distanceMeters,
    withinGeofence: true,
  };
};

export default {
  calculateHaversineDistanceMeters,
  evaluateGeofence,
};
