import { Router } from 'express';
import { getGeofence, updateGeofence } from '../controllers/settings.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import { geofenceSettingsSchema } from '../validators/settings.validator.js';

const router = Router();

router.get(
  '/geofence',
  authenticate,
  authorize(ROLES.ADMIN),
  getGeofence
);

router.put(
  '/geofence',
  authenticate,
  authorize(ROLES.ADMIN),
  validate({ body: geofenceSettingsSchema }),
  updateGeofence
);

export default router;
