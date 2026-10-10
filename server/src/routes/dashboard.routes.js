import { Router } from 'express';
import { handleGetDashboardSummary } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authenticate, handleGetDashboardSummary);

export default router;
