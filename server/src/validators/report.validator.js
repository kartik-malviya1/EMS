import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const dailyReportQuerySchema = z
  .object({
    date: z.string().regex(dateRegex, 'date must be YYYY-MM-DD').optional(),
    from: z.string().regex(dateRegex, 'from must be YYYY-MM-DD').optional(),
    to: z.string().regex(dateRegex, 'to must be YYYY-MM-DD').optional(),
    userId: z.string().regex(objectIdRegex, 'Invalid userId format').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const exportReportQuerySchema = z
  .object({
    date: z.string().regex(dateRegex, 'date must be YYYY-MM-DD').optional(),
    from: z.string().regex(dateRegex, 'from must be YYYY-MM-DD').optional(),
    to: z.string().regex(dateRegex, 'to must be YYYY-MM-DD').optional(),
    userId: z.string().regex(objectIdRegex, 'Invalid userId format').optional(),
    format: z.enum(['xlsx', 'pdf']),
  })
  .strict();
