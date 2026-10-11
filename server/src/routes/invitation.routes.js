import { Router } from 'express';
import {
  create,
  list,
  getEmailStatus,
  getById,
  resend,
  revoke,
  checkDelivery,
} from '../controllers/invitation.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  createInvitationSchema,
  invitationQuerySchema,
} from '../validators/invitation.validator.js';
import { mongoIdParamSchema } from '../validators/user.validator.js';
import { adminInvitationSendLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// All invitation management endpoints require an authenticated Admin
router.use(authenticate, authorize(ROLES.ADMIN));

router.post(
  '/',
  adminInvitationSendLimiter,
  validate({ body: createInvitationSchema }),
  create
);

router.get('/', validate({ query: invitationQuerySchema }), list);

// Static route MUST be registered before /:id parameter match
router.get('/email-status', getEmailStatus);

router.get('/:id', validate({ params: mongoIdParamSchema }), getById);

router.post(
  '/:id/resend',
  adminInvitationSendLimiter,
  validate({ params: mongoIdParamSchema }),
  resend
);

router.post('/:id/revoke', validate({ params: mongoIdParamSchema }), revoke);

router.post(
  '/:id/check-delivery',
  validate({ params: mongoIdParamSchema }),
  checkDelivery
);

export default router;
