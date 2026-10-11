import { Router } from 'express';
import {
  signup,
  login,
  logout,
  getMe,
  getSocketToken,
  getAuthConfig,
  requestInvitationLink,
  validateInvitation,
  acceptInvitationHandler,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  signupLimiter,
  loginLimiter,
  requestLinkIpLimiter,
  requestLinkEmailLimiter,
} from '../middleware/rateLimiter.js';
import { signupSchema, loginSchema } from '../validators/auth.validator.js';
import {
  requestLinkSchema,
  validateTokenSchema,
  acceptInvitationSchema,
} from '../validators/invitation.validator.js';

const router = Router();

// Public auth configuration
router.get('/config', getAuthConfig);

router.post('/signup', signupLimiter, validate({ body: signupSchema }), signup);
router.post('/login', loginLimiter, validate({ body: loginSchema }), login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.get('/socket-token', authenticate, getSocketToken);

// Public invitation endpoints
router.post(
  '/invitations/request-link',
  requestLinkIpLimiter,
  requestLinkEmailLimiter,
  validate({ body: requestLinkSchema }),
  requestInvitationLink
);

router.post(
  '/invitations/validate',
  validate({ body: validateTokenSchema }),
  validateInvitation
);

router.post(
  '/accept-invitation',
  signupLimiter,
  validate({ body: acceptInvitationSchema }),
  acceptInvitationHandler
);

export default router;
