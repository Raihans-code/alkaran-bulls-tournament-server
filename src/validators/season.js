import { z } from 'zod';

const status = z.enum(['UPCOMING', 'REGISTRATION', 'AUCTION', 'RUNNING', 'COMPLETED', 'CANCELLED']);
const date = z.coerce.date().optional().nullable();

const base = {
  name: z.string().trim().min(2).max(100),
  seasonNumber: z.coerce.number().int().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  description: z.string().trim().max(1000).optional().nullable(),
  startDate: date,
  endDate: date,
  maxTeams: z.coerce.number().int().min(2).max(64).default(10),
  // Business rule: default 8 players per team. Admin may lower/raise per season but it is enforced server-side.
  maxPlayersPerTeam: z.coerce.number().int().min(1).max(30).default(8),
  initialTeamBudget: z.coerce.number().int().min(0).default(10000),
  bidIncrement: z.coerce.number().int().min(1).default(100),
  allowMultipleTeamsPerUser: z.boolean().default(false),
  winPoints: z.coerce.number().int().min(0).default(2),
  tiePoints: z.coerce.number().int().min(0).default(1),
  noResultPoints: z.coerce.number().int().min(0).default(1),
  lossPoints: z.coerce.number().int().min(0).default(0),
};

export const createSeasonSchema = z.object(base);
export const updateSeasonSchema = z.object(base).partial();
export const seasonStatusSchema = z.object({ status, championTeamId: z.string().uuid().optional() });
