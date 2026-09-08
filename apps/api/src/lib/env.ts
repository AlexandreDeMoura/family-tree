import { z } from 'zod';

export const env = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('127.0.0.1'),
  WEB_ORIGIN: z.url(),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ORGANIZER_USER_ID: z.uuid(),
}).parse(process.env);
