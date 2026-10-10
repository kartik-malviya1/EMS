import { z } from 'zod';

export const geofenceSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    officeLatitude: z.number().min(-90).max(90).optional(),
    officeLongitude: z.number().min(-180).max(180).optional(),
    radiusMeters: z.number().min(1).optional(),
    maxAccuracyMeters: z.number().min(1).optional(),
  })
  .strict();
