import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const detectMagicMimeType = (buffer) => {
  if (!buffer || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
};

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPEG, PNG and WebP images are allowed'));
    }
    cb(null, true);
  },
});

export const selfieUploadMiddleware = (req, res, next) => {
  upload.single('selfie')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(413, 'FILE_TOO_LARGE', 'Selfie must not exceed 2 MB'));
      }
      if (err instanceof ApiError) {
        return next(err);
      }
      return next(new ApiError(400, 'VALIDATION_ERROR', err.message));
    }

    if (!req.file) {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Selfie image is required'));
    }

    // Magic-byte check on actual file buffer
    const magicMime = detectMagicMimeType(req.file.buffer);
    if (!magicMime || !ALLOWED_MIME_TYPES.includes(magicMime)) {
      return next(
        new ApiError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Invalid image format: file contents do not match image magic bytes'
        )
      );
    }

    req.file.verifiedMimeType = magicMime;
    next();
  });
};

export default selfieUploadMiddleware;
