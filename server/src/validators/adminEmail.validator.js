import { z } from 'zod';

export const sendTestEmailSchema = z
  .object({
    to: z.string().email('Valid recipient email address is required').trim().toLowerCase(),
  })
  .strict();

export const providerMessageIdParamSchema = z
  .object({
    providerMessageId: z.string().min(1, 'Provider message ID is required').trim(),
  })
  .strict();
