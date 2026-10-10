import { Router } from 'express';
import {
  handlePunchIn,
  handlePunchOut,
  getTodayAttendance,
  getMyAttendance,
  getTeamAttendance,
  getAllAttendance,
  getAttendanceRecord,
  streamSelfieImage,
} from '../controllers/attendance.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { selfieUploadMiddleware } from '../middleware/upload.js';
import { punchLimiter } from '../middleware/rateLimiter.js';
import { ROLES } from '../config/constants.js';
import { mongoIdParamSchema } from '../validators/user.validator.js';
import {
  punchPayloadSchema,
  attendanceQuerySchema,
  selfieParamSchema,
} from '../validators/attendance.validator.js';

const router = Router();

// Punch endpoints
router.post(
  '/punch-in',
  authenticate,
  punchLimiter,
  selfieUploadMiddleware,
  validate({ body: punchPayloadSchema }),
  handlePunchIn
);

router.post(
  '/punch-out',
  authenticate,
  punchLimiter,
  selfieUploadMiddleware,
  validate({ body: punchPayloadSchema }),
  handlePunchOut
);

// Today's attendance
router.get('/today', authenticate, getTodayAttendance);

// Personal attendance history
router.get(
  '/me',
  authenticate,
  validate({ query: attendanceQuerySchema }),
  getMyAttendance
);

// Team attendance (Manager only)
router.get(
  '/team',
  authenticate,
  authorize(ROLES.MANAGER),
  validate({ query: attendanceQuerySchema }),
  getTeamAttendance
);

// System-wide attendance (Admin only)
router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate({ query: attendanceQuerySchema }),
  getAllAttendance
);

// Stream selfie image (authorized by scope)
router.get(
  '/:id/selfies/:kind',
  authenticate,
  validate({ params: selfieParamSchema }),
  streamSelfieImage
);

// Single attendance record by ID (authorized by scope)
router.get(
  '/:id',
  authenticate,
  validate({ params: mongoIdParamSchema }),
  getAttendanceRecord
);

export default router;
