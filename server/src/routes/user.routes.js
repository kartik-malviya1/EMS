import { Router } from 'express';
import {
  getUsers,
  getTeam,
  getManagers,
  getUser,
  updateUser,
} from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  userQuerySchema,
  userUpdateSchema,
  mongoIdParamSchema,
} from '../validators/user.validator.js';

const router = Router();

// Manager endpoint: own team members
router.get('/team', authenticate, authorize(ROLES.MANAGER), getTeam);

// Admin endpoint: active managers for assignment dropdown
router.get('/managers', authenticate, authorize(ROLES.ADMIN), getManagers);

// Admin endpoints: list users, get user, update user
router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate({ query: userQuerySchema }),
  getUsers
);

router.get(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate({ params: mongoIdParamSchema }),
  getUser
);

router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate({ params: mongoIdParamSchema, body: userUpdateSchema }),
  updateUser
);

export default router;
