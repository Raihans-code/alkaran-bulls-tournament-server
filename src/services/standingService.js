import { prisma } from '../utils/prisma.js';
import { getSeasonOrThrow } from './seasonService.js';

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Rebuilds the whole table for a season from COMPLETED matches.
 * Recomputing (instead of incrementing) makes result corrections idempotent and keeps history consistent.
 * NRR rule: an all-out innings counts as the full overs quota.
 */
export async function recomputeStandings(db, seasonId) {
  const season = await getSeasonOrThrow(seasonId, db);
  const teams = await db.team.findMany({ where: { seasonId, registrationStatus: 'APPROVED' }, select: { id: true } });
  const matches = await db.match.findMany({ where: { seasonId, status: 'COMPLETED' }, include: { innings: true } });
  const maxWickets = season.maxPlayersPerTeam - 1;

  const table = new Map(teams.map((t) => [t.id, { played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0 }]));

  for (const m of matches) {
    const a = table.get(m.teamAId);
    const b = table.get(m.teamBId);
    if (!a || !b) continue;
    a.played += 1; b.played += 1;
    if (m.resultType === 'WIN' && m.winnerId) {
      const [w, l] = m.winnerId === m.teamAId ? [a, b] : [b, a];
      w.won += 1; w.points += season.winPoints;
      l.lost += 1; l.points += season.lossPoints;
    } else if (m.resultType === 'TIE') {
      for (const t of [a, b]) { t.tied += 1; t.points += season.tiePoints; }
    } else {
      for (const t of [a, b]) { t.noResult += 1; t.points += season.noResultPoints; }
    }
    if (m.resultType === 'NO_RESULT') continue; // no NRR impact
    for (const inn of m.innings) {
      const bat = table.get(inn.battingTeamId);
      const bowl = table.get(inn.bowlingTeamId);
      if (!bat || !bowl) continue;
      const balls = inn.wickets >= maxWickets ? m.oversLimit * 6 : inn.balls;
      bat.runsFor += inn.runs; bat.ballsFaced += balls;
      bowl.runsAgainst += inn.runs; bowl.ballsBowled += balls;
    }
  }

  for (const [teamId, s] of table) {
    const nrr = (s.ballsFaced ? s.runsFor / (s.ballsFaced / 6) : 0) - (s.ballsBowled ? s.runsAgainst / (s.ballsBowled / 6) : 0);
    const data = { ...s, netRunRate: round3(nrr) };
    await db.teamStanding.upsert({ where: { teamId }, update: data, create: { teamId, seasonId, ...data } });
  }
}

export async function getStandings(seasonId) {
  await getSeasonOrThrow(seasonId);
  const teams = await prisma.team.findMany({ where: { seasonId, registrationStatus: 'APPROVED' }, select: { id: true } });
  if (teams.length) await prisma.teamStanding.createMany({ data: teams.map((t) => ({ teamId: t.id, seasonId })), skipDuplicates: true });
  const rows = await prisma.teamStanding.findMany({
    where: { seasonId, team: { registrationStatus: 'APPROVED' } },
    include: { team: { select: { id: true, name: true, logo: true } } },
  });
  rows.sort((x, y) => y.points - x.points || y.netRunRate - x.netRunRate || y.won - x.won || x.team.name.localeCompare(y.team.name));
  return rows.map((r, i) => ({ ...r, position: i + 1 }));
}
