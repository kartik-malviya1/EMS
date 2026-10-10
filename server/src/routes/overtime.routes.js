import { Router } from 'express';
import { handleListPendingOvertime } from '../controllers/attendance.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import { pendingOvertimeQuerySchema } from '../validators/attendance.validator.js';

const router = Router();

// Pending overtime queue (Manager, Admin)
router.get(
  '/pending',
  authenticate,
  authorize(ROLES.MANAGER, ROLES.ADMIN),
  validate({ query: pendingOvertimeQuerySchema }),
  handleListPendingOvertime
);

export default router;
