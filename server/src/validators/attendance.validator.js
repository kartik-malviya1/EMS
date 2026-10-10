import { z } from 'zod';
import {
  WORKING_STATUS_LIST,
  VERIFICATION_STATUS_LIST,
  VERIFICATION_STATUS,
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

export const attendanceIdParamSchema = z
  .object({
    id: z.string().regex(objectIdRegex, 'Invalid Attendance ID'),
  })
  .strict();

export const selfieParamSchema = z
  .object({
    id: z.string().regex(objectIdRegex, 'Invalid Attendance ID'),
    kind: z.enum(['punch-in', 'punch-out']),
  })
  .strict();

export const reviewVerificationSchema = z
  .object({
    status: z.enum([VERIFICATION_STATUS.VALID, VERIFICATION_STATUS.INVALID]),
    remarks: z.string().trim().max(500).optional().nullable(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.status === VERIFICATION_STATUS.INVALID) {
      if (!val.remarks || val.remarks.length < 5 || val.remarks.length > 500) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Remarks are required for invalid verification and must be between 5 and 500 characters',
          path: ['remarks'],
        });
      }
    }
  });

export const requestOvertimeSchema = z
  .object({
    requestedMinutes: z.coerce
      .number()
      .int()
      .positive('Requested minutes must be a positive integer'),
    reason: z
      .string()
      .trim()
      .min(5, 'Reason must be at least 5 characters')
      .max(500, 'Reason cannot exceed 500 characters'),
  })
  .strict();

export const reviewOvertimeSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    remarks: z.string().trim().max(500).optional().nullable(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.decision === 'rejected') {
      if (!val.remarks || val.remarks.length < 5 || val.remarks.length > 500) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Remarks are required when rejecting overtime and must be between 5 and 500 characters',
          path: ['remarks'],
        });
      }
    }
  });

export const pendingOvertimeQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

