import { Router } from 'express';
import {
  handleGetDailyReport,
  handleExportDailyReport,
} from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  dailyReportQuerySchema,
  exportReportQuerySchema,
} from '../validators/report.validator.js';

const router = Router();

router.get('/daily/export', authenticate, validate({ query: exportReportQuerySchema }), handleExportDailyReport);
router.get('/daily', authenticate, validate({ query: dailyReportQuerySchema }), handleGetDailyReport);

export default router;
