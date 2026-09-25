import { prisma } from '../utils/prisma.js';
import { AppError, badRequest, notFound } from '../utils/errors.js';
import { audit } from '../utils/audit.js';
import { assertSeasonWritable } from '../utils/seasonGuard.js';
import { assertCanScore, broadcastMatch, getScoreboard } from './matchService.js';
import { oversToBalls } from '../utils/overs.js';

async function loadMatch(actor, matchId) {
  assertCanScore(actor);
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { season: true } });
  if (!match) throw notFound('Match');
  assertSeasonWritable(match.season, { actor, correction: true });
  // Scores can only change while live. After completion only an admin may correct them.
  if (match.status === 'COMPLETED' && actor.role !== 'ADMIN') throw new AppError(409, 'MATCH_COMPLETED', 'Completed match scores can only be corrected by an admin');
  if (!['LIVE', 'COMPLETED'].includes(match.status)) throw new AppError(409, 'MATCH_NOT_LIVE', 'Start the match before entering scores');
  return match;
}

async function assertPlayersInSeason(seasonId, ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return;
  const count = await prisma.player.count({ where: { id: { in: list }, seasonId } });
  if (count !== list.length) throw badRequest('INVALID_PLAYER', 'Selected players must belong to this season');
}

export async function updateInnings(actor, matchId, inningsNumber, body) {
  if (![1, 2].includes(inningsNumber)) throw badRequest('INVALID_INNINGS', 'Innings must be 1 or 2');
  const match = await loadMatch(actor, matchId);
  const maxWickets = match.season.maxPlayersPerTeam - 1;
  const existing = await prisma.matchScore.findUnique({ where: { matchId_inningsNumber: { matchId, inningsNumber } } });

  let battingTeamId = existing?.battingTeamId;
  let bowlingTeamId = existing?.bowlingTeamId;
  if (!existing) {
    const inn1 = inningsNumber === 2 ? await prisma.matchScore.findUnique({ where: { matchId_inningsNumber: { matchId, inningsNumber: 1 } } }) : null;
    if (inningsNumber === 2 && !inn1) throw badRequest('INNINGS_ORDER', 'Start the first innings first');
    battingTeamId = body.battingTeamId ?? (inn1 ? inn1.bowlingTeamId : undefined);
    if (![match.teamAId, match.teamBId].includes(battingTeamId)) throw badRequest('INVALID_TEAM', 'Batting team must be one of the match teams');
    bowlingTeamId = battingTeamId === match.teamAId ? match.teamBId : match.teamAId;
    if (inningsNumber === 2 && body.target == null) body.target = inn1.runs + 1;
  }

  const data = {};
  if (body.runs !== undefined) data.runs = body.runs;
  if (body.wickets !== undefined) {
    if (body.wickets > maxWickets) throw badRequest('INVALID_WICKETS', `A team of ${match.season.maxPlayersPerTeam} is all out at ${maxWickets} wickets`);
    data.wickets = body.wickets;
  }
  if (body.overs !== undefined) {
    let balls;
    try { balls = oversToBalls(body.overs); } catch { throw badRequest('INVALID_OVERS', 'Overs must look like 12.3 (max 5 balls)'); }
    if (balls > match.oversLimit * 6) throw badRequest('INVALID_OVERS', `Innings is limited to ${match.oversLimit} overs`);
    data.balls = balls;
  }
  for (const k of ['extras', 'target', 'strikerId', 'nonStrikerId', 'bowlerId', 'status']) if (body[k] !== undefined) data[k] = body[k];
  const dismissedBatterIds = existing?.dismissedBatterIds ?? [];
  const strikerId = data.strikerId ?? existing?.strikerId;
  const nonStrikerId = data.nonStrikerId ?? existing?.nonStrikerId;
  if (strikerId && strikerId === nonStrikerId) {
    throw badRequest('DUPLICATE_BATTER', 'The striker and non-striker must be different batters');
  }
  if ([strikerId, nonStrikerId].some((id) => id && dismissedBatterIds.includes(id))) {
    throw badRequest('DISMISSED_BATTER', 'A dismissed batter cannot be selected again');
  }
  if (existing && body.bowlerId !== undefined && existing.balls % 6 !== 0 && body.bowlerId !== existing.bowlerId) {
    throw new AppError(409, 'BOWLER_OVER_IN_PROGRESS', 'The current bowler must finish the over before changing bowlers');
  }
  if (existing && body.bowlerId && existing.balls % 6 === 0 && body.bowlerId === existing.lastBowlerId) {
    throw new AppError(409, 'BOWLER_CHANGE_REQUIRED', 'Select a different bowler for the new over');
  }
  await assertPlayersInSeason(match.seasonId, [data.strikerId, data.nonStrikerId, data.bowlerId]);

  await prisma.matchScore.upsert({
    where: { matchId_inningsNumber: { matchId, inningsNumber } },
    update: data,
    create: { matchId, inningsNumber, battingTeamId, bowlingTeamId, ...data },
  });
  await audit(null, { userId: actor.id, action: 'SCORE_CHANGED', entity: 'Match', entityId: matchId, seasonId: match.seasonId, metadata: { inningsNumber, ...data } });
  return broadcastMatch(matchId, match.seasonId);
}

/** Ball-by-ball helper: one legal delivery (or extra) at a time, race-safe via row lock. */
export async function addBall(actor, matchId, inningsNumber, { runs, extraType, wicket, dismissal }) {
  const match = await loadMatch(actor, matchId);
  const maxWickets = match.season.maxPlayersPerTeam - 1;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "MatchScore" WHERE "matchId" = ${matchId} AND "inningsNumber" = ${inningsNumber} FOR UPDATE`;
    const inn = await tx.matchScore.findUnique({ where: { matchId_inningsNumber: { matchId, inningsNumber } } });
    if (!inn) throw notFound('Innings');
    if (inn.status === 'COMPLETED') throw new AppError(409, 'INNINGS_COMPLETED', 'This innings is already completed');
    if (!inn.bowlerId) throw new AppError(409, 'BOWLER_REQUIRED', 'Select a bowler before recording the next ball');
    if (!inn.strikerId || !inn.nonStrikerId) throw new AppError(409, 'BATTER_REQUIRED', 'Select the replacement batter before recording the next ball');
    if (wicket && dismissal && dismissal === 'NON_STRIKER' && !inn.nonStrikerId) throw new AppError(409, 'INVALID_DISMISSAL', 'No non-striker is available to dismiss');

    const wideOrNoBall = extraType === 'WD' || extraType === 'NB';
    const legal = !wideOrNoBall;
    const penalty = wideOrNoBall ? 1 : 0;
    const total = runs + penalty;
    const batterRuns = ['WD', 'B', 'LB'].includes(extraType) ? 0 : runs;
    const bowlerRuns = ['B', 'LB'].includes(extraType) ? 0 : total;
    const next = { runs: inn.runs + total, wickets: inn.wickets + (wicket ? 1 : 0), balls: inn.balls + (legal ? 1 : 0), extras: inn.extras + (extraType ? (extraType === 'NB' ? 1 : total) : 0) };

    // Strike rotation: odd runs, and end of over.
    let { strikerId, nonStrikerId } = inn;
    const dismissedBatterIds = [...(inn.dismissedBatterIds ?? [])];
    if (wicket) {
      const dismissedId = dismissal === 'NON_STRIKER' ? nonStrikerId : strikerId;
      if (dismissedId) dismissedBatterIds.push(dismissedId);
      if (dismissal === 'NON_STRIKER') nonStrikerId = null;
      else strikerId = null;
    }
    if (strikerId && nonStrikerId) {
      if (runs % 2 === 1 && extraType !== 'WD') [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
      if (legal && next.balls % 6 === 0) [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
    }
    let status = inn.status;
    if (next.wickets >= maxWickets || next.balls >= match.oversLimit * 6 || (inn.target && next.runs >= inn.target)) status = 'COMPLETED';
    const overComplete = legal && next.balls % 6 === 0;
    await tx.matchScore.update({ where: { id: inn.id }, data: { ...next, strikerId, nonStrikerId, dismissedBatterIds, bowlerId: overComplete ? null : inn.bowlerId, lastBowlerId: overComplete ? inn.bowlerId : inn.lastBowlerId, status } });
    await tx.matchPlayerStatistic.upsert({
      where: { matchId_playerId: { matchId, playerId: inn.strikerId } },
      update: { runs: { increment: batterRuns }, ballsFaced: { increment: legal ? 1 : 0 }, fours: { increment: batterRuns === 4 ? 1 : 0 }, sixes: { increment: batterRuns === 6 ? 1 : 0 } },
      create: { matchId, playerId: inn.strikerId, runs: batterRuns, ballsFaced: legal ? 1 : 0, fours: batterRuns === 4 ? 1 : 0, sixes: batterRuns === 6 ? 1 : 0 },
    });
    await tx.matchPlayerStatistic.upsert({
      where: { matchId_playerId: { matchId, playerId: inn.bowlerId } },
      update: { wickets: { increment: wicket && dismissal !== 'NON_STRIKER' ? 1 : 0 }, ballsBowled: { increment: legal ? 1 : 0 }, runsConceded: { increment: bowlerRuns } },
      create: { matchId, playerId: inn.bowlerId, wickets: wicket && dismissal !== 'NON_STRIKER' ? 1 : 0, ballsBowled: legal ? 1 : 0, runsConceded: bowlerRuns },
    });
    await audit(tx, { userId: actor.id, action: 'SCORE_CHANGED', entity: 'Match', entityId: matchId, seasonId: match.seasonId, metadata: { inningsNumber, ball: { runs, extraType, wicket } } });
  });
  return broadcastMatch(matchId, match.seasonId);
}

export async function saveStats(actor, matchId, rows) {
  const match = await loadMatch(actor, matchId);
  await assertPlayersInSeason(match.seasonId, rows.map((r) => r.playerId));
  await prisma.$transaction(async (tx) => {
    for (const { playerId, ...stats } of rows) {
      await tx.matchPlayerStatistic.upsert({ where: { matchId_playerId: { matchId, playerId } }, update: stats, create: { matchId, playerId, ...stats } });
    }
    await audit(tx, { userId: actor.id, action: 'MATCH_STATS_SAVED', entity: 'Match', entityId: matchId, seasonId: match.seasonId, metadata: { rows: rows.length } });
  });
  return broadcastMatch(matchId, match.seasonId);
}

export { getScoreboard };
