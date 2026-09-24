import { prisma } from '../utils/prisma.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { audit } from '../utils/audit.js';
import { lockSeason } from '../utils/lock.js';
import { assertSeasonWritable } from '../utils/seasonGuard.js';
import { getSeasonOrThrow } from './seasonService.js';
import { recomputeStandings } from './standingService.js';
import { publish, matchRoom, seasonRoom } from '../sockets/emitter.js';
import { oversToBalls, ballsToOvers } from '../utils/overs.js';

const teamSel = { select: { id: true, name: true, logo: true } };
const matchInclude = { teamA: teamSel, teamB: teamSel, winner: teamSel, innings: { orderBy: { inningsNumber: 'asc' } } };

export async function listMatches({ seasonId, status }) {
  await getSeasonOrThrow(seasonId);
  return prisma.match.findMany({
    where: { seasonId, ...(status && { status }) },
    include: matchInclude,
    orderBy: [{ matchNumber: 'asc' }],
  });
}

/** Full scoreboard payload used by REST and Socket.IO. */
export async function getScoreboard(matchId, db = prisma) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { ...matchInclude, stats: { include: { player: { select: { id: true, name: true, currentTeamId: true } } } } },
  });
  if (!match) throw notFound('Match');
  const ids = [...new Set(match.innings.flatMap((i) => [i.strikerId, i.nonStrikerId, i.bowlerId]).concat(match.playerOfMatchId).filter(Boolean))];
  const players = ids.length ? await db.player.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  return {
    ...match,
    playerOfMatch: match.playerOfMatchId ? byId[match.playerOfMatchId] ?? null : null,
    innings: match.innings.map((i) => ({
      ...i,
      overs: ballsToOvers(i.balls),
      striker: byId[i.strikerId] ?? null,
      nonStriker: byId[i.nonStrikerId] ?? null,
      bowler: byId[i.bowlerId] ?? null,
    })),
  };
}

export async function broadcastMatch(matchId, seasonId) {
  const scoreboard = await getScoreboard(matchId);
  publish(matchRoom(matchId), 'score:update', scoreboard);
  publish(seasonRoom(seasonId), 'score:update', scoreboard);
  return scoreboard;
}

async function approvedTeamOrThrow(tx, seasonId, teamId) {
  const team = await tx.team.findUnique({ where: { id: teamId } });
  if (!team || team.seasonId !== seasonId || team.registrationStatus !== 'APPROVED') {
    throw badRequest('INVALID_TEAM', 'Both teams must be approved teams of this season');
  }
  return team;
}

export async function createMatch(actor, data) {
  const match = await prisma.$transaction(async (tx) => {
    await lockSeason(tx, data.seasonId);
    const season = await getSeasonOrThrow(data.seasonId, tx);
    assertSeasonWritable(season, { actor });
    if (data.teamAId === data.teamBId) throw badRequest('SAME_TEAM', 'A team cannot play itself');
    await approvedTeamOrThrow(tx, data.seasonId, data.teamAId);
    await approvedTeamOrThrow(tx, data.seasonId, data.teamBId);
    let matchNumber = data.matchNumber;
    if (!matchNumber) {
      const max = await tx.match.aggregate({ where: { seasonId: data.seasonId }, _max: { matchNumber: true } });
      matchNumber = (max._max.matchNumber ?? 0) + 1;
    } else if (await tx.match.findFirst({ where: { seasonId: data.seasonId, matchNumber } })) {
      throw conflict('MATCH_NUMBER_TAKEN', `Match #${matchNumber} already exists in this season`);
    }
    const created = await tx.match.create({ data: { ...data, matchNumber } });
    await audit(tx, { userId: actor.id, action: 'MATCH_CREATED', entity: 'Match', entityId: created.id, seasonId: data.seasonId, metadata: { matchNumber } });
    return created;
  });
  return getScoreboard(match.id);
}

export async function updateMatch(actor, id, data) {
  const match = await prisma.match.findUnique({ where: { id }, include: { season: true } });
  if (!match) throw notFound('Match');
  assertSeasonWritable(match.season, { actor, correction: true });
  if (match.status === 'COMPLETED') throw conflict('MATCH_COMPLETED', 'Completed matches are historical records and cannot be edited');
  if ((data.teamAId || data.teamBId) && match.status !== 'UPCOMING') throw conflict('MATCH_STARTED', 'Teams can only change before the match starts');
  const a = data.teamAId ?? match.teamAId;
  const b = data.teamBId ?? match.teamBId;
  if (a === b) throw badRequest('SAME_TEAM', 'A team cannot play itself');
  if (data.teamAId) await approvedTeamOrThrow(prisma, match.seasonId, a);
  if (data.teamBId) await approvedTeamOrThrow(prisma, match.seasonId, b);
  await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id }, data });
    if (data.status === 'ABANDONED') await recomputeStandings(tx, match.seasonId);
    await audit(tx, { userId: actor.id, action: 'MATCH_UPDATED', entity: 'Match', entityId: id, seasonId: match.seasonId, metadata: { changed: Object.keys(data) } });
  });
  return broadcastMatch(id, match.seasonId);
}

export async function deleteMatch(actor, id) {
  const match = await prisma.match.findUnique({ where: { id }, include: { season: true } });
  if (!match) throw notFound('Match');
  assertSeasonWritable(match.season, { actor });
  if (match.status !== 'UPCOMING') throw conflict('MATCH_STARTED', 'Only upcoming matches can be deleted');
  await prisma.match.delete({ where: { id } });
  await audit(null, { userId: actor.id, action: 'MATCH_DELETED', entity: 'Match', entityId: id, seasonId: match.seasonId, metadata: { matchNumber: match.matchNumber } });
  publish(seasonRoom(match.seasonId), 'match:list', { seasonId: match.seasonId });
}

export async function startMatch(actor, id, { battingTeamId }) {
  const match = await prisma.match.findUnique({ where: { id }, include: { season: true } });
  if (!match) throw notFound('Match');
  assertSeasonWritable(match.season, { actor });
  if (match.status !== 'UPCOMING') throw conflict('MATCH_NOT_UPCOMING', 'Only upcoming matches can be started');
  if (![match.teamAId, match.teamBId].includes(battingTeamId)) throw badRequest('INVALID_TEAM', 'Batting team must be one of the two teams');
  const bowlingTeamId = battingTeamId === match.teamAId ? match.teamBId : match.teamAId;
  await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id }, data: { status: 'LIVE' } });
    await tx.matchScore.create({ data: { matchId: id, inningsNumber: 1, battingTeamId, bowlingTeamId, status: 'IN_PROGRESS' } });
    await audit(tx, { userId: actor.id, action: 'MATCH_STARTED', entity: 'Match', entityId: id, seasonId: match.seasonId });
  });
  return broadcastMatch(id, match.seasonId);
}

export async function completeMatch(actor, id, body) {
  const match = await prisma.match.findUnique({ where: { id }, include: { season: true, innings: true, teamA: teamSel, teamB: teamSel } });
  if (!match) throw notFound('Match');
  const correction = match.status === 'COMPLETED';
  assertSeasonWritable(match.season, { actor, correction: true });
  if (!['LIVE', 'COMPLETED'].includes(match.status)) throw conflict('MATCH_NOT_LIVE', 'Start the match before completing it');

  const maxWickets = match.season.maxPlayersPerTeam - 1;
  const inn1 = match.innings.find((i) => i.inningsNumber === 1);
  const inn2 = match.innings.find((i) => i.inningsNumber === 2);
  const nameOf = (tid) => (tid === match.teamAId ? match.teamA.name : match.teamB.name);

  let { resultType, winnerId, resultText } = body;
  if (!resultType) {
    if (!inn1 || !inn2) throw badRequest('RESULT_REQUIRED', 'Both innings are needed to work out the result. Choose the result manually.');
    const target = inn2.target ?? inn1.runs + 1;
    if (inn2.runs >= target) { resultType = 'WIN'; winnerId = inn2.battingTeamId; resultText ||= `${nameOf(winnerId)} won by ${Math.max(0, maxWickets - inn2.wickets)} wickets`; }
    else if (inn2.runs === inn1.runs) { resultType = 'TIE'; }
    else { resultType = 'WIN'; winnerId = inn1.battingTeamId; resultText ||= `${nameOf(winnerId)} won by ${inn1.runs - inn2.runs} runs`; }
  }
  if (resultType === 'WIN') {
    if (![match.teamAId, match.teamBId].includes(winnerId)) throw badRequest('WINNER_REQUIRED', 'Choose the winning team');
    resultText ||= `${nameOf(winnerId)} won`;
  } else {
    winnerId = null;
    resultText ||= resultType === 'TIE' ? 'Match tied' : 'No result';
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id }, data: { status: 'COMPLETED', resultType, winnerId, resultText, playerOfMatchId: body.playerOfMatchId ?? undefined } });
    await tx.matchScore.updateMany({ where: { matchId: id }, data: { status: 'COMPLETED' } });
    await recomputeStandings(tx, match.seasonId);
    await audit(tx, { userId: actor.id, action: correction ? 'MATCH_RESULT_CORRECTED' : 'MATCH_COMPLETED', entity: 'Match', entityId: id, seasonId: match.seasonId, metadata: { resultType, winnerId, resultText } });
  });
  publish(seasonRoom(match.seasonId), 'standings:update', { seasonId: match.seasonId });
  return broadcastMatch(id, match.seasonId);
}

export function assertCanScore(actor) {
  if (actor.role !== 'ADMIN' && !actor.canScore) throw forbidden('You do not have scoring permission');
}

export { oversToBalls };
