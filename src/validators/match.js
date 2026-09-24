import { z } from 'zod';

const uid = z.string().uuid();

export const createMatchSchema = z.object({
  seasonId: uid,
  matchNumber: z.coerce.number().int().min(1).optional(),
  teamAId: uid,
  teamBId: uid,
  venue: z.string().trim().max(120).optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
  oversLimit: z.coerce.number().int().min(1).max(50).default(10),
});

export const updateMatchSchema = createMatchSchema.omit({ seasonId: true }).partial().extend({
  status: z.enum(['UPCOMING', 'ABANDONED']).optional(),
});

export const startMatchSchema = z.object({ battingTeamId: uid });

export const matchListQuery = z.object({
  seasonId: uid,
  status: z.enum(['UPCOMING', 'LIVE', 'COMPLETED', 'ABANDONED']).optional(),
});

export const completeMatchSchema = z.object({
  resultType: z.enum(['WIN', 'TIE', 'NO_RESULT']).optional(),
  winnerId: uid.optional().nullable(),
  resultText: z.string().trim().max(200).optional(),
  playerOfMatchId: uid.optional().nullable(),
});

export const inningsSchema = z.object({
  battingTeamId: uid.optional(),
  runs: z.coerce.number().int().min(0).max(999).optional(),
  wickets: z.coerce.number().int().min(0).max(30).optional(),
  overs: z.union([z.string(), z.number()]).optional(),
  extras: z.coerce.number().int().min(0).optional(),
  target: z.coerce.number().int().min(0).optional().nullable(),
  strikerId: uid.optional().nullable(),
  nonStrikerId: uid.optional().nullable(),
  bowlerId: uid.optional().nullable(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
});

export const ballSchema = z.object({
  runs: z.coerce.number().int().min(0).max(7).default(0),
  extraType: z.enum(['WD', 'NB', 'B', 'LB']).optional().nullable(),
  wicket: z.boolean().default(false),
});

export const statsSchema = z.object({
  rows: z
    .array(
      z.object({
        playerId: uid,
        runs: z.coerce.number().int().min(0).default(0),
        ballsFaced: z.coerce.number().int().min(0).default(0),
        fours: z.coerce.number().int().min(0).default(0),
        sixes: z.coerce.number().int().min(0).default(0),
        wickets: z.coerce.number().int().min(0).default(0),
        ballsBowled: z.coerce.number().int().min(0).default(0),
        runsConceded: z.coerce.number().int().min(0).default(0),
      }),
    )
    .max(60),
});
