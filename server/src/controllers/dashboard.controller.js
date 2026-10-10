import { getDashboardSummary as getDashboardSummaryService } from '../services/dashboard.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const handleGetDashboardSummary = asyncHandler(async (req, res) => {
  const summary = await getDashboardSummaryService(req.user);
  return sendSuccess(res, summary, 200);
});
