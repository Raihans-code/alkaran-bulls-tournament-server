import { AppError } from './errors.js';

/** Completed/cancelled seasons are read-only, except explicit admin corrections. */
export function assertSeasonWritable(season, { actor, correction = false } = {}) {
  if (['COMPLETED', 'CANCELLED'].includes(season.status)) {
    if (correction && actor?.role === 'ADMIN') return;
    throw new AppError(409, 'SEASON_READ_ONLY', `Season is ${season.status.toLowerCase()} and read-only`);
  }
}
