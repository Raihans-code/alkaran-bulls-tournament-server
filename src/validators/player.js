import { z } from 'zod';
import { url } from './common.js';

const category = z.enum(['ICON', 'BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER', 'GENERAL']);

export const createPlayerSchema = z.object({
  seasonId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  image: url,
  phone: z.string().trim().max(30).optional().nullable(),
  category: category.default('GENERAL'),
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
          .transform((v) => v.toUpperCase().replace(/[\s-]+/g, '_'))
          .pipe(category)
          .catch('GENERAL')
          .default('GENERAL'),
        phone: z.string().trim().max(30).optional().nullable(),
      }),
    )
    .min(1)
    .max(500),
});

export const playerListQuery = z.object({
  seasonId: z.string().uuid(),
  status: z.enum(['AVAILABLE', 'IN_AUCTION', 'SOLD', 'UNSOLD', 'WITHDRAWN']).optional(),
  category: category.optional(),
  q: z.string().trim().max(80).optional(),
});
