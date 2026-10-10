import { Router } from 'express';
import {
  handleListNotifications,
  handleGetUnreadCount,
  handleMarkAsRead,
  handleMarkAllAsRead,
} from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  notificationQuerySchema,
  notificationIdParamSchema,
} from '../validators/notification.validator.js';

const router = Router();

router.get('/unread-count', authenticate, handleGetUnreadCount);
router.patch('/read-all', authenticate, handleMarkAllAsRead);
router.patch('/:id/read', authenticate, validate({ params: notificationIdParamSchema }), handleMarkAsRead);
router.get('/', authenticate, validate({ query: notificationQuerySchema }), handleListNotifications);

export default router;
