import { sendError } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, _next) => {
  logger.error(`${req.method} ${req.originalUrl}:`, err.message || err);

  if (err instanceof ApiError) {
    return sendError(res, err.code, err.message, err.statusCode, err.details);
  }

  // Handle SyntaxError in JSON body parsing
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, 'VALIDATION_ERROR', 'Invalid JSON payload', 400);
  }

  // Centralized fallback error response
  return sendError(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500);
};

export const notFound = (req, res) => {
  return sendError(res, 'NOT_FOUND', `Route ${req.originalUrl} not found`, 404);
};
