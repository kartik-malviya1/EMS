import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

dotenv.config();

const emailFromRegex = /^(?:([^<]+)\s*<)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?$/;

export const parseEmailAddress = (fromStr) => {
  if (!fromStr) return { name: '', address: '', domain: '' };
  const match = fromStr.trim().match(emailFromRegex);
  if (!match) return { name: '', address: '', domain: '' };
  const name = match[1]?.trim().replace(/^["']|["']$/g, '') || '';
  const address = match[2]?.trim().toLowerCase() || '';
  const domain = address.split('@')[1] || '';
  return { name, address, domain };
};

const envSchema = z
  .object({
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

    // Email & Invitations
    EMAIL_PROVIDER: z.enum(['resend']).default('resend'),
    EMAIL_MODE: z.enum(['development', 'resend', 'test']).default('development'),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default('AMS Portal <onboarding@resend.dev>'),
    EMAIL_REPLY_TO: z.string().email().optional().or(z.literal('')),
    APP_BASE_URL: z.string().default('http://localhost:5173'),
    INVITATION_EXPIRY_HOURS: z.coerce.number().default(72),
    INVITATION_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(60),
    INVITATION_MAX_RESENDS: z.coerce.number().default(10),
    EMAIL_SEND_TIMEOUT_MS: z.coerce.number().default(10000),
    ALLOW_PUBLIC_REGISTRATION: z
      .preprocess((val) => {
        if (val === undefined || val === '') return true;
        return val === true || val === 'true';
      }, z.boolean())
      .default(true),
  })
  .superRefine((data, ctx) => {
    // Normalise APP_BASE_URL
    try {
      const parsedUrl = new URL(data.APP_BASE_URL);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['APP_BASE_URL'],
          message: 'APP_BASE_URL must have http or https protocol',
        });
      } else {
        data.APP_BASE_URL = `${parsedUrl.protocol}//${parsedUrl.host}`;
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_BASE_URL'],
        message: 'APP_BASE_URL must be a valid URL',
      });
    }

    // EMAIL_MODE=resend validations
    if (data.EMAIL_MODE === 'resend') {
      const key = data.RESEND_API_KEY?.trim() || '';
      if (!key || !key.startsWith('re_') || key === 're_xxxxxxxxx') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RESEND_API_KEY'],
          message:
            'RESEND_API_KEY must be a valid key starting with "re_" and not "re_xxxxxxxxx" when EMAIL_MODE=resend',
        });
      }

      if (!data.EMAIL_FROM || !emailFromRegex.test(data.EMAIL_FROM.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_FROM'],
          message:
            'EMAIL_FROM must be a valid email address or "Display Name <address@domain.com>"',
        });
      }
    }

    // Production rules
    if (data.NODE_ENV === 'production') {
      if (data.EMAIL_MODE !== 'resend') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_MODE'],
          message: 'EMAIL_MODE must be set to "resend" in production',
        });
      }

      try {
        const prodUrl = new URL(data.APP_BASE_URL);
        if (prodUrl.protocol !== 'https:') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['APP_BASE_URL'],
            message: 'APP_BASE_URL must use https in production',
          });
        }
        if (['localhost', '127.0.0.1'].includes(prodUrl.hostname)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['APP_BASE_URL'],
            message: 'APP_BASE_URL cannot use a localhost hostname in production',
          });
        }
      } catch {
        // Handled in general APP_BASE_URL check
      }
    }
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
