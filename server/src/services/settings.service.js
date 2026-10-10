import { Settings } from '../models/settings.model.js';
import { env } from '../config/env.js';

export const getGeofenceSettings = async () => {
  let settings = await Settings.findOne({ key: 'geofence' });
  if (!settings) {
    // Seed from env on first call if not in DB
    try {
      settings = await Settings.create({
        key: 'geofence',
        enabled: env.GEOFENCE_ENABLED ?? false,
        officeLatitude: env.GEOFENCE_OFFICE_LAT ?? 28.6139,
        officeLongitude: env.GEOFENCE_OFFICE_LNG ?? 77.209,
        radiusMeters: env.GEOFENCE_RADIUS_METERS ?? 200,
        maxAccuracyMeters: env.GEOFENCE_MAX_ACCURACY_METERS ?? 100,
      });
    } catch (err) {
      if (
        err.code === 11000 ||
        err.errorResponse?.code === 11000 ||
        err.message?.includes('E11000')
      ) {
        settings = await Settings.findOne({ key: 'geofence' });
      } else {
        throw err;
      }
    }
  }
  return settings;
};

export const updateGeofenceSettings = async (data) => {
  let settings = await Settings.findOne({ key: 'geofence' });
  if (!settings) {
    settings = await getGeofenceSettings();
  }

  if (data.enabled !== undefined) settings.enabled = data.enabled;
  if (data.officeLatitude !== undefined) settings.officeLatitude = data.officeLatitude;
  if (data.officeLongitude !== undefined) settings.officeLongitude = data.officeLongitude;
  if (data.radiusMeters !== undefined) settings.radiusMeters = data.radiusMeters;
  if (data.maxAccuracyMeters !== undefined) settings.maxAccuracyMeters = data.maxAccuracyMeters;

  await settings.save();
  return settings;
};

export default {
  getGeofenceSettings,
  updateGeofenceSettings,
};
