import { Router } from 'express';
import {
  sendTest,
  getMessageStatus,
} from '../controllers/adminEmail.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  sendTestEmailSchema,
  providerMessageIdParamSchema,
} from '../validators/adminEmail.validator.js';
import {
  adminEmailTestLimiter,
  adminMessageStatusLimiter,
} from '../middleware/rateLimiter.js';

const router = Router();

// Admin-only endpoints
router.use(authenticate, authorize(ROLES.ADMIN));

router.post(
  '/test',
  adminEmailTestLimiter,
  validate({ body: sendTestEmailSchema }),
  sendTest
);

router.get(
  '/messages/:providerMessageId',
  adminMessageStatusLimiter,
  validate({ params: providerMessageIdParamSchema }),
  getMessageStatus
);

export default router;
