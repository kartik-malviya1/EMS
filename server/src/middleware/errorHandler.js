import { sendError } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, _next) => {
  if (process.env.NODE_ENV !== 'test') {
    logger.error(`${req.method} ${req.originalUrl}:`, err);
  }

  // 1. ApiError
  if (err instanceof ApiError) {
    return sendError(res, err.code, err.message, err.statusCode, err.details);
  }

  // 2. Zod validation error
  if (err?.issues) {
    const details = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return sendError(res, 'VALIDATION_ERROR', 'Validation failed', 400, details);
  }

  // 3. Mongoose Validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => ({
      path: e.path,
      message: e.message,
    }));
    return sendError(res, 'VALIDATION_ERROR', 'Validation failed', 400, details);
  }

  // 4. Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, 'VALIDATION_ERROR', `Invalid ${err.path}: ${err.value}`, 400);
  }

  // 5. Mongo duplicate key error (code 11000)
  if (err.code === 11000) {
    const keys = Object.keys(err.keyValue || {});
    const field = keys.length > 0 ? keys[0] : 'field';
    return sendError(res, 'CONFLICT', `Duplicate value for ${field}`, 409);
  }

  // 6. JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'UNAUTHENTICATED', 'Invalid authentication token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'TOKEN_EXPIRED', 'Authentication token has expired', 401);
  }

  // 7. Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 'FILE_TOO_LARGE', 'Uploaded file exceeds size limit', 413);
  }
  if (err.name === 'MulterError') {
    return sendError(res, 'VALIDATION_ERROR', err.message, 400);
  }

  // 8. SyntaxError in JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, 'VALIDATION_ERROR', 'Invalid JSON payload', 400);
  }

  // 9. Centralized fallback
  return sendError(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500);
};

export const notFound = (req, res) => {
  return sendError(res, 'NOT_FOUND', `Route ${req.originalUrl} not found`, 404);
};

export default errorHandler;
