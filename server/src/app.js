import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import { sendSuccess } from './utils/response.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { originCheck } from './middleware/originCheck.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import overtimeRoutes from './routes/overtime.routes.js';
import reportRoutes from './routes/report.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import invitationRoutes from './routes/invitation.routes.js';
import adminEmailRoutes from './routes/adminEmail.routes.js';

const app = express();

if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);


// Origin check for CSRF defense
app.use(originCheck);

// Global rate limiting
app.use(globalLimiter);

// Logging
if (env.NODE_ENV !== 'test') {
  const morganFormat = env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(morganFormat));
}

// Request parsers
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  return sendSuccess(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Auth endpoints
app.use('/api/auth', authRoutes);

// Users endpoints
app.use('/api/users', userRoutes);

// Attendance endpoints
app.use('/api/attendance', attendanceRoutes);

// Overtime endpoints
app.use('/api/overtime', overtimeRoutes);

// Reports endpoints
app.use('/api/reports', reportRoutes);

// Dashboard endpoints
app.use('/api/dashboard', dashboardRoutes);

// Settings endpoints
app.use('/api/settings', settingsRoutes);

// Notifications endpoints
app.use('/api/notifications', notificationRoutes);

// Admin invitation endpoints
app.use('/api/admin/invitations', invitationRoutes);

// Admin email verification endpoints
app.use('/api/admin/email', adminEmailRoutes);

// 404 handler
app.use(notFound);

// Central error handler
app.use(errorHandler);

export default app;
