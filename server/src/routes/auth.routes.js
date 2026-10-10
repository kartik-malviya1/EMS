import { Router } from 'express';
import {
  signup,
  login,
  logout,
  getMe,
  getSocketToken,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { signupLimiter, loginLimiter } from '../middleware/rateLimiter.js';
import { signupSchema, loginSchema } from '../validators/auth.validator.js';

const router = Router();

router.post('/signup', signupLimiter, validate({ body: signupSchema }), signup);
router.post('/login', loginLimiter, validate({ body: loginSchema }), login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.get('/socket-token', authenticate, getSocketToken);

export default router;
