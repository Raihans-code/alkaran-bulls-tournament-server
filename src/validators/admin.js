import { z } from 'zod';

export const updateUserSchema = z.object({
  role: z.enum(['ADMIN', 'OWNER', 'USER']).optional(),
  isActive: z.boolean().optional(),
  canScore: z.boolean().optional(),
});

export const auditQuery = z.object({
  seasonId: z.string().uuid().optional(),
  entity: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
