import {
  sendAdminTestEmail,
  getEmailMessageDetails,
} from '../services/adminEmail.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const sendTest = asyncHandler(async (req, res) => {
  const result = await sendAdminTestEmail({
    adminUser: req.user,
    to: req.body.to,
    req,
  });
  return sendSuccess(res, result, 200);
});

export const getMessageStatus = asyncHandler(async (req, res) => {
  const result = await getEmailMessageDetails({
    providerMessageId: req.params.providerMessageId,
  });
  return sendSuccess(res, result, 200);
});
