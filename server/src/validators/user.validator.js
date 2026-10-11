import { z } from 'zod';
import { ROLE_LIST, ACCOUNT_STATUS_LIST } from '../config/constants.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const mongoIdParamSchema = z
  .object({
    id: z.string().regex(objectIdRegex, 'Invalid ObjectId format'),
  })
  .strict();

export const userQuerySchema = z
  .object({
    role: z.enum(ROLE_LIST).optional(),
    accountStatus: z.enum(ACCOUNT_STATUS_LIST).optional(),
    search: z.string().trim().optional(),
    isActive: z
      .preprocess((val) => {
        if (val === 'true' || val === true) return true;
        if (val === 'false' || val === false) return false;
        return val;
      }, z.boolean())
      .optional(),
    managerId: z.string().regex(objectIdRegex, 'Invalid managerId format').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const userUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name must be at most 80 characters')
      .optional(),
    role: z.enum(ROLE_LIST).optional(),
    employeeId: z.string().trim().max(30).optional(),
    department: z.string().trim().max(60).optional(),
    designation: z.string().trim().max(60).optional(),
    accountStatus: z.enum(ACCOUNT_STATUS_LIST).optional(),
    dateOfJoining: z.string().nullable().optional(),
    managerId: z
      .string()
      .regex(objectIdRegex, 'Invalid managerId format')
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

