import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const notificationQuerySchema = z
  .object({
    unreadOnly: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((val) => val === true || val === 'true')
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const notificationIdParamSchema = z
  .object({
    id: z.string().regex(objectIdRegex, 'Invalid Notification ID'),
  })
  .strict();
