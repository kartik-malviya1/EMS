import { z } from 'zod';

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name must be at most 80 characters'),
    email: z
      .string()
      .trim()
      .email('Invalid email address')
      .max(100, 'Email must be at most 100 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be at most 72 characters')
      .regex(passwordRegex, 'Password must contain at least one letter and one number'),
    confirmPassword: z.string().optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();
