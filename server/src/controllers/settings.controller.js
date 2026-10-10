import {
  getGeofenceSettings,
  updateGeofenceSettings,
} from '../services/settings.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getGeofence = asyncHandler(async (_req, res) => {
  const settings = await getGeofenceSettings();
  return sendSuccess(res, settings, 200);
});

export const updateGeofence = asyncHandler(async (req, res) => {
  const settings = await updateGeofenceSettings(req.body);
  return sendSuccess(res, settings, 200);
});
