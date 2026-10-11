import { Router } from 'express';
import {
  apply,
  getMyLeaves,
  getTeamLeaves,
  getAllLeaves,
  getById,
  cancel,
  review,
} from '../controllers/leave.controller.js';
import {
  authenticate,
  authorize,
  requireWorkforce,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  applyLeaveSchema,
  reviewLeaveSchema,
  leaveQuerySchema,
} from '../validators/leave.validator.js';
import { mongoIdParamSchema } from '../validators/user.validator.js';

const router = Router();

// Apply for leave (Employees & Managers)
router.post(
  '/',
  authenticate,
  requireWorkforce,
  validate({ body: applyLeaveSchema }),
  apply
);

// Get my leave requests (Employees & Managers)
router.get(
  '/me',
  authenticate,
  validate({ query: leaveQuerySchema }),
  getMyLeaves
);

// Get team leave requests (Managers only)
router.get(
  '/team',
  authenticate,
  authorize(ROLES.MANAGER),
  validate({ query: leaveQuerySchema }),
  getTeamLeaves
);

// Get all leave requests system-wide (Admins only)
router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate({ query: leaveQuerySchema }),
  getAllLeaves
);

// Get single leave request by ID
router.get(
  '/:id',
  authenticate,
  validate({ params: mongoIdParamSchema }),
  getById
);

// Cancel own pending leave request
router.patch(
  '/:id/cancel',
  authenticate,
  validate({ params: mongoIdParamSchema }),
  cancel
);

// Review (approve/reject) leave request (Managers & Admins)
router.patch(
  '/:id/review',
  authenticate,
  authorize(ROLES.MANAGER, ROLES.ADMIN),
  validate({ params: mongoIdParamSchema, body: reviewLeaveSchema }),
  review
);

export default router;
