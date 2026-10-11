import { z } from 'zod';
import { ROLES, INVITATION_STATUS_LIST } from '../config/constants.js';

export const createInvitationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be at most 80 characters'),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
  role: z.enum([ROLES.EMPLOYEE, ROLES.MANAGER], {
    errorMap: () => ({ message: 'Role must be either employee or manager' }),
  }),
  employeeId: z
    .string()
    .trim()
    .max(30, 'Employee ID must be at most 30 characters')
    .optional(),
  department: z
    .string()
    .trim()
    .max(60, 'Department must be at most 60 characters')
    .optional(),
  designation: z
    .string()
    .trim()
    .max(60, 'Designation must be at most 60 characters')
    .optional(),
  managerId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid manager ID format')
    .nullable()
    .optional(),
});

export const invitationQuerySchema = z.object({
  status: z.enum(INVITATION_STATUS_LIST).optional(),
  role: z.enum([ROLES.EMPLOYEE, ROLES.MANAGER]).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const validateTokenSchema = z.object({
  token: z.string().min(16, 'Invalid invitation token format'),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(16, 'Invalid invitation token format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
