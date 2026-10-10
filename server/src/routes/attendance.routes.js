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
  handleReviewVerification,
  handleRequestOvertime,
  handleReviewOvertime,
} from '../controllers/attendance.controller.js';
import { authenticate, authorize, requireWorkforce } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { selfieUploadMiddleware } from '../middleware/upload.js';
import { punchLimiter } from '../middleware/rateLimiter.js';
import { ROLES } from '../config/constants.js';
import { mongoIdParamSchema } from '../validators/user.validator.js';
import {
  punchPayloadSchema,
  attendanceQuerySchema,
  selfieParamSchema,
  reviewVerificationSchema,
  requestOvertimeSchema,
  reviewOvertimeSchema,
} from '../validators/attendance.validator.js';

const router = Router();

// Punch endpoints (require workforce role; checked before upload so no image is stored)
router.post(
  '/punch-in',
  authenticate,
  requireWorkforce,
  punchLimiter,
  selfieUploadMiddleware,
  validate({ body: punchPayloadSchema }),
  handlePunchIn
);

router.post(
  '/punch-out',
  authenticate,
  requireWorkforce,
  punchLimiter,
  selfieUploadMiddleware,
  validate({ body: punchPayloadSchema }),
  handlePunchOut
);

// Today's attendance
router.get('/today', authenticate, requireWorkforce, getTodayAttendance);

// Personal attendance history
router.get(
  '/me',
  authenticate,
  requireWorkforce,
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

// Verification review (Manager, Admin)
router.patch(
  '/:id/verification',
  authenticate,
  authorize(ROLES.MANAGER, ROLES.ADMIN),
  validate({ params: mongoIdParamSchema, body: reviewVerificationSchema }),
  handleReviewVerification
);

// Overtime request (Owner only, workforce role)
router.post(
  '/:id/overtime',
  authenticate,
  requireWorkforce,
  validate({ params: mongoIdParamSchema, body: requestOvertimeSchema }),
  handleRequestOvertime
);

// Overtime review (Manager, Admin)
router.patch(
  '/:id/overtime/review',
  authenticate,
  authorize(ROLES.MANAGER, ROLES.ADMIN),
  validate({ params: mongoIdParamSchema, body: reviewOvertimeSchema }),
  handleReviewOvertime
);

// Single attendance record by ID (authorized by scope)
router.get(
  '/:id',
  authenticate,
  validate({ params: mongoIdParamSchema }),
  getAttendanceRecord
);

export default router;

