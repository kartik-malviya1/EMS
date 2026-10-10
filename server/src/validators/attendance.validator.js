import { z } from 'zod';
import {
  WORKING_STATUS_LIST,
  VERIFICATION_STATUS_LIST,
  OVERTIME_STATUS_LIST,
  ROLE_LIST,
} from '../config/constants.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const punchPayloadSchema = z
  .object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    accuracy: z.coerce.number().min(0),
  })
  .passthrough(); // allows file from multipart

export const attendanceQuerySchema = z
  .object({
    from: z.string().regex(dateRegex, 'from must be YYYY-MM-DD').optional(),
    to: z.string().regex(dateRegex, 'to must be YYYY-MM-DD').optional(),
    userId: z.string().regex(objectIdRegex, 'Invalid userId format').optional(),
    workingStatus: z.enum(WORKING_STATUS_LIST).optional(),
    verificationStatus: z.enum(VERIFICATION_STATUS_LIST).optional(),
    overtimeStatus: z.enum(OVERTIME_STATUS_LIST).optional(),
    role: z.enum(ROLE_LIST).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const selfieParamSchema = z
  .object({
    id: z.string().regex(objectIdRegex, 'Invalid Attendance ID'),
    kind: z.enum(['punch-in', 'punch-out']),
  })
  .strict();
