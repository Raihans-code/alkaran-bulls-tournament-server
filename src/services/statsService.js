import { prisma } from '../utils/prisma.js';
import { getSeasonOrThrow } from './seasonService.js';

export async function seasonStats(seasonId) {
  const season = await getSeasonOrThrow(seasonId);
  const squad = await prisma.squadPlayer.findMany({
    where: { seasonId },
    orderBy: { price: 'desc' },
    include: { player: { select: { id: true, name: true, category: true, image: true } }, team: { select: { id: true, name: true } } },
  });
  const [playerCounts, teamRows, matchCount, batting, bowling] = await Promise.all([
    prisma.player.groupBy({ by: ['status'], where: { seasonId }, _count: { _all: true } }),
    prisma.team.findMany({ where: { seasonId, registrationStatus: 'APPROVED' }, include: { squad: { select: { price: true } } } }),
    prisma.match.count({ where: { seasonId, status: 'COMPLETED' } }),
    prisma.matchPlayerStatistic.groupBy({ by: ['playerId'], where: { match: { seasonId } }, _sum: { runs: true, ballsFaced: true, fours: true, sixes: true }, orderBy: { _sum: { runs: 'desc' } }, take: 5 }),
    prisma.matchPlayerStatistic.groupBy({ by: ['playerId'], where: { match: { seasonId } }, _sum: { wickets: true, runsConceded: true, ballsBowled: true }, orderBy: { _sum: { wickets: 'desc' } }, take: 5 }),
  ]);
  const ids = [...new Set([...batting, ...bowling].map((r) => r.playerId))];
  const people = ids.length ? await prisma.player.findMany({ where: { id: { in: ids } }, include: { currentTeam: { select: { name: true } } } }) : [];
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const who = (r) => ({ playerId: r.playerId, name: byId[r.playerId]?.name, team: byId[r.playerId]?.currentTeam?.name });

  const counts = Object.fromEntries(playerCounts.map((c) => [c.status, c._count._all]));
  return {
    season: { id: season.id, name: season.name, status: season.status },
    totals: {
      players: playerCounts.reduce((n, c) => n + c._count._all, 0),
      sold: counts.SOLD ?? 0,
      unsold: counts.UNSOLD ?? 0,
      withdrawn: counts.WITHDRAWN ?? 0,
      available: counts.AVAILABLE ?? 0,
      totalSpent: squad.reduce((n, s) => n + s.price, 0),
      matchesPlayed: matchCount,
    },
    highestPurchase: squad[0] ?? null,
    topPurchases: squad.slice(0, 10),
    mostRuns: batting.filter((r) => r._sum.runs > 0).map((r) => ({ ...who(r), ...r._sum })),
    mostWickets: bowling.filter((r) => r._sum.wickets > 0).map((r) => ({ ...who(r), ...r._sum })),
    teams: teamRows.map((t) => ({ id: t.id, name: t.name, logo: t.logo, purse: t.purse, squadCount: t.squad.length, totalSpent: t.squad.reduce((n, s) => n + s.price, 0) })),
  };
}

/** Champions and headline records for every finished season. */
export async function history() {
  const seasons = await prisma.season.findMany({ orderBy: { seasonNumber: 'desc' }, include: { _count: { select: { teams: true, players: true, matches: true } } } });
  const teamIds = seasons.map((s) => s.championTeamId).filter(Boolean);
  const champs = teamIds.length ? await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true, logo: true, owner: { select: { name: true } } } }) : [];
  const top = await prisma.squadPlayer.findMany({ orderBy: { price: 'desc' }, take: 1, include: { player: { select: { name: true } }, team: { select: { name: true } }, season: { select: { name: true } } } });
  const perSeason = await Promise.all(
    seasons.map(async (s) => {
      const best = await prisma.squadPlayer.findFirst({ where: { seasonId: s.id }, orderBy: { price: 'desc' }, include: { player: { select: { name: true } }, team: { select: { name: true } } } });
      return [s.id, best];
    }),
  );
  const bestBySeason = Object.fromEntries(perSeason);
  return {
    seasons: seasons.map((s) => ({ ...s, champion: champs.find((c) => c.id === s.championTeamId) ?? null, mostExpensive: bestBySeason[s.id] ?? null })),
    allTimeHighestPurchase: top[0] ?? null,
  };
}
