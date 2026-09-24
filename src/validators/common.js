import { z } from 'zod';

export const uuid = z.string().uuid('Invalid id');
export const idParam = z.object({ id: uuid });
const optionalText = (max = 500) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
export { optionalText };
export const url = z.string().trim().max(500).optional().nullable().transform((v) => (v ? v : null));
export const seasonQuery = z.object({ seasonId: uuid });
