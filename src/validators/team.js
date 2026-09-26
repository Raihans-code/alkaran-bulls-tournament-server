import { z } from 'zod';
import { url } from './common.js';

export const registerTeamSchema = z.object({
  seasonId: z.string().uuid(),
  name: z.string().trim().min(2).max(60),
  logo: url,
  contactInfo: z.string().trim().max(200).optional().nullable(),
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  logo: url,
  contactInfo: z.string().trim().max(200).optional().nullable(),
});

export const registrationSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED', 'PENDING']) });
export const purseSchema = z.union([
  z.object({ delta: z.coerce.number().int(), reason: z.string().trim().max(200).optional() }),
  z.object({ purse: z.coerce.number().int().min(0), reason: z.string().trim().max(200).optional() }),
]);
export const teamListQuery = z.object({
  seasonId: z.string().uuid(),
  status: z.enum(['APPROVED', 'REJECTED', 'PENDING']).optional(),
});
