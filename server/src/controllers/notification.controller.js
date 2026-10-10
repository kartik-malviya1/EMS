import {
  listUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notification.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const handleListNotifications = asyncHandler(async (req, res) => {
  const result = await listUserNotifications(req.user._id, req.query);
  return sendSuccess(res, result.notifications, 200, result.meta);
});

export const handleGetUnreadCount = asyncHandler(async (req, res) => {
  const result = await getUnreadNotificationCount(req.user._id);
  return sendSuccess(res, result, 200);
});

export const handleMarkAsRead = asyncHandler(async (req, res) => {
  const result = await markNotificationAsRead(req.user._id, req.params.id);
  return sendSuccess(res, result, 200);
});

export const handleMarkAllAsRead = asyncHandler(async (req, res) => {
  const result = await markAllNotificationsAsRead(req.user._id);
  return sendSuccess(res, result, 200);
});
