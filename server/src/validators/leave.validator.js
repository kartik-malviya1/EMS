import { z } from 'zod';
import {
  LEAVE_TYPE_LIST,
  LEAVE_STATUS_LIST,
  HALF_DAY_PERIOD_LIST,
} from '../config/constants.js';

export const applyLeaveSchema = z
  .object({
    leaveType: z.enum(LEAVE_TYPE_LIST, {
      errorMap: () => ({ message: 'Invalid leave type' }),
    }),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
    isHalfDay: z.boolean().optional().default(false),
    halfDayPeriod: z.enum(HALF_DAY_PERIOD_LIST).optional().nullable(),
    reason: z
      .string()
      .trim()
      .min(5, 'Reason must be at least 5 characters')
      .max(500, 'Reason cannot exceed 500 characters'),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'Start date cannot be after end date',
    path: ['endDate'],
  })
  .refine(
    (data) => {
      if (data.isHalfDay) {
        return data.startDate === data.endDate;
      }
      return true;
    },
    {
      message: 'Half-day leave must be on a single date (start date and end date must match)',
      path: ['isHalfDay'],
    }
  )
  .refine(
    (data) => {
      if (data.isHalfDay && !data.halfDayPeriod) {
        return false;
      }
      return true;
    },
    {
      message: 'Half-day period (first_half or second_half) is required when half-day is selected',
      path: ['halfDayPeriod'],
    }
  );

export const reviewLeaveSchema = z
  .object({
    action: z.enum(['approve', 'reject'], {
      errorMap: () => ({ message: 'Action must be either "approve" or "reject"' }),
    }),
    remarks: z
      .string()
      .trim()
      .max(500, 'Remarks cannot exceed 500 characters')
      .optional()
      .default(''),
  })
  .refine(
    (data) => {
      if (data.action === 'reject') {
        return data.remarks && data.remarks.length >= 5;
      }
      return true;
    },
    {
      message: 'Remarks of at least 5 characters are required when rejecting leave',
      path: ['remarks'],
    }
  );

export const leaveQuerySchema = z.object({
  status: z.enum(LEAVE_STATUS_LIST).optional(),
  leaveType: z.enum(LEAVE_TYPE_LIST).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be in YYYY-MM-DD format')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be in YYYY-MM-DD format')
    .optional(),
  userId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format')
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
