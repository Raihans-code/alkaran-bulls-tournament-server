import { z } from 'zod';
import { url } from './common.js';

const category = z.enum(['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','NO_CATEGORY']);

export const createPlayerSchema = z.object({
  seasonId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  image: url,
  phone: z.string().trim().max(30).optional().nullable(),
  category: category.default('NO_CATEGORY'),
  basePrice: z.coerce.number().int().min(0),
});

export const updatePlayerSchema = createPlayerSchema.omit({ seasonId: true }).partial();

export const importPlayersSchema = z.object({
  seasonId: z.string().uuid(),
  players: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(80),
        basePrice: z.coerce.number().int().min(0).default(100),
        category: z
          .string()
          .trim()
          .transform((v) => {
            const s = v.toUpperCase().replace(/[\s-]+/g, '_');
            const map = { ICON: 'A', BATSMAN: 'B', BOWLER: 'C', ALL_ROUNDER: 'D', WICKET_KEEPER: 'E', GENERAL: 'NO_CATEGORY' };
            if (map[s]) return map[s];
            if (/^[A-Z]$/.test(s)) return s;
            if (s === 'NO_CATEGORY') return 'NO_CATEGORY';
            return 'NO_CATEGORY';
          })
          .pipe(category)
          .catch('NO_CATEGORY')
          .default('NO_CATEGORY'),
        phone: z.string().trim().max(30).optional().nullable(),
      }),
    )
    .min(1)
    .max(500),
});

export const assignPlayerSchema = z.object({
  teamId: z.string().uuid(),
  price: z.coerce.number().int().min(0),
});

export const playerListQuery = z.object({
  seasonId: z.string().uuid(),
  status: z.enum(['AVAILABLE', 'IN_AUCTION', 'SOLD', 'UNSOLD', 'WITHDRAWN']).optional(),
  category: category.optional(),
  q: z.string().trim().max(80).optional(),
});
