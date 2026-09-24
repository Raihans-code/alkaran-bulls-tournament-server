import { z } from 'zod';

export const startAuctionSchema = z.object({ seasonId: z.string().uuid(), playerId: z.string().uuid() });
export const seasonOnlySchema = z.object({ seasonId: z.string().uuid() });
// teamId is optional and never trusted: the server verifies the caller owns it (or derives the team itself).
export const bidSchema = z.object({ seasonId: z.string().uuid(), amount: z.coerce.number().int().positive(), teamId: z.string().uuid().optional() });
export const resetPlayerSchema = z.object({ playerId: z.string().uuid() });
