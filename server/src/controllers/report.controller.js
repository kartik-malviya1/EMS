import {
  getDailyReportData,
  exportDailyReport as exportDailyReportService,
} from '../services/report.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const handleGetDailyReport = asyncHandler(async (req, res) => {
  const result = await getDailyReportData(req.user, req.query);
  return res.status(200).json({
    success: true,
    data: result.rows,
    summary: result.summary,
    meta: {
      ...result.meta,
      summary: result.summary,
    },
  });
});

export const handleExportDailyReport = asyncHandler(async (req, res) => {
  return exportDailyReportService(req.user, req.query, res);
});
