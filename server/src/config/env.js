import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  BUSINESS_TIMEZONE: z.string().default('Asia/Kolkata'),
  STANDARD_SHIFT_MINUTES: z.coerce.number().default(480),
  WORKING_DAYS: z.string().default('1,2,3,4,5'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('attendance'),

  GEOFENCE_ENABLED: z
    .preprocess((val) => val === true || val === 'true', z.boolean())
    .default(false),
  GEOFENCE_OFFICE_LAT: z.coerce.number().default(28.6139),
  GEOFENCE_OFFICE_LNG: z.coerce.number().default(77.209),
  GEOFENCE_RADIUS_METERS: z.coerce.number().default(200),
  GEOFENCE_MAX_ACCURACY_METERS: z.coerce.number().default(100),

  ADMIN_NAME: z.string().default('System Administrator'),
  ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  ADMIN_PASSWORD: z.string().optional(),

  ENABLE_CRON: z
    .preprocess((val) => val === true || val === 'true', z.boolean())
    .default(true),
  MISSED_PUNCH_IN_ALERT_TIME: z.string().default('11:00'),
  MISSED_PUNCH_OUT_ALERT_TIME: z.string().default('20:00'),
  AUTO_CLOSE_TIME: z.string().default('00:10'),
});

let parsedEnv;

export const validateEnv = (customEnv = process.env) => {
  try {
    return envSchema.parse(customEnv);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      logger.error(`\nEnvironment validation failed:\n${issues}\n`);
    } else {
      logger.error('Environment validation error:', error);
    }
    throw new Error('Invalid environment configuration', { cause: error });
  }
};

// In test environment, provide safe defaults if MONGODB_URI/JWT_SECRET are not pre-set
if (process.env.NODE_ENV === 'test') {
  if (!process.env.MONGODB_URI) {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test_placeholder';
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test_jwt_secret_must_be_at_least_32_characters_long!';
  }
}

try {
  parsedEnv = validateEnv(process.env);
} catch {
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
  parsedEnv = {};
}

export const env = parsedEnv;
export default env;
