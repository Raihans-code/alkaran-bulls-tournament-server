/**
 * Serialises all auction / squad / purse mutations for one season.
 * Must be called inside prisma.$transaction. Row lock is released on commit/rollback.
 * This is what makes two near-simultaneous bids deterministic.
 */
export async function lockSeason(tx, seasonId) {
  const rows = await tx.$queryRaw`SELECT id FROM "Season" WHERE id = ${seasonId} FOR UPDATE`;
  return rows.length > 0;
}
