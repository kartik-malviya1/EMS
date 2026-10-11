import { Router } from 'express';
import {
  create,
  list,
  getById,
  resend,
  revoke,
  checkDelivery,
} from '../controllers/teamInvitation.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  createTeamInvitationSchema,
  teamInvitationQuerySchema,
} from '../validators/invitation.validator.js';
import { mongoIdParamSchema } from '../validators/user.validator.js';
import { adminInvitationSendLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Manager role only for all team invitation endpoints
router.use(authenticate, authorize(ROLES.MANAGER));

router.post(
  '/',
  adminInvitationSendLimiter,
  validate({ body: createTeamInvitationSchema }),
  create
);

router.get(
  '/',
  validate({ query: teamInvitationQuerySchema }),
  list
);

router.get(
  '/:id',
  validate({ params: mongoIdParamSchema }),
  getById
);

router.post(
  '/:id/resend',
  adminInvitationSendLimiter,
  validate({ params: mongoIdParamSchema }),
  resend
);

router.post(
  '/:id/revoke',
  validate({ params: mongoIdParamSchema }),
  revoke
);

router.post(
  '/:id/check-delivery',
  validate({ params: mongoIdParamSchema }),
  checkDelivery
);

export default router;

