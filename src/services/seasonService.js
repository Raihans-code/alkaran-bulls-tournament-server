import { prisma } from '../utils/prisma.js';
import { AppError, badRequest, conflict, notFound } from '../utils/errors.js';
import { audit } from '../utils/audit.js';
import { assertSeasonWritable } from '../utils/seasonGuard.js';
import { lockSeason } from '../utils/lock.js';

const TRANSITIONS = {
  UPCOMING: ['REGISTRATION', 'CANCELLED'],
  REGISTRATION: ['UPCOMING', 'AUCTION', 'CANCELLED'],
  AUCTION: ['REGISTRATION', 'RUNNING', 'CANCELLED'],
  RUNNING: ['AUCTION', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['RUNNING'], // admin correction: re-open
  CANCELLED: ['UPCOMING'],
};

export async function getSeasonOrThrow(id, db = prisma) {
  const season = await db.season.findUnique({ where: { id } });
  if (!season) throw notFound('Season');
  return season;
}

export async function listSeasons() {
  return prisma.season.findMany({
    orderBy: { seasonNumber: 'desc' },
    include: { _count: { select: { teams: true, players: true, matches: true } } },
  });
}

export async function getSeason(id) {
  const season = await prisma.season.findUnique({
    where: { id },
    include: { _count: { select: { teams: true, players: true, matches: true } } },
  });
  if (!season) throw notFound('Season');
  const champion = season.championTeamId
    ? await prisma.team.findUnique({ where: { id: season.championTeamId }, select: { id: true, name: true, logo: true } })
    : null;
  return { ...season, champion };
}

export async function createSeason(actor, data) {
  if (await prisma.season.findUnique({ where: { seasonNumber: data.seasonNumber } })) {
    throw conflict('SEASON_EXISTS', `Season ${data.seasonNumber} already exists`);
  }
  const season = await prisma.season.create({ data });
  await audit(null, { userId: actor.id, action: 'SEASON_CREATED', entity: 'Season', entityId: season.id, seasonId: season.id, metadata: { name: season.name } });
  return season;
}

export async function updateSeason(actor, id, data) {
  const season = await getSeasonOrThrow(id);
  assertSeasonWritable(season, { actor, correction: true });
  if (data.seasonNumber && data.seasonNumber !== season.seasonNumber) {
    if (await prisma.season.findUnique({ where: { seasonNumber: data.seasonNumber } })) throw conflict('SEASON_EXISTS', 'Season number already used');
  }
  if (data.maxPlayersPerTeam !== undefined) {
    const biggest = await prisma.squadPlayer.groupBy({ by: ['teamId'], where: { seasonId: id }, _count: { _all: true }, orderBy: { _count: { teamId: 'desc' } }, take: 1 });
    if (biggest[0] && biggest[0]._count._all > data.maxPlayersPerTeam) {
      throw badRequest('SQUAD_LIMIT_TOO_LOW', 'A team already has more players than this limit');
    }
  }
  const updated = await prisma.season.update({ where: { id }, data });
  await audit(null, { userId: actor.id, action: 'SETTINGS_CHANGED', entity: 'Season', entityId: id, seasonId: id, metadata: { changed: Object.keys(data) } });
  return updated;
}

export async function setStatus(actor, id, { status, championTeamId }) {
  return prisma.$transaction(async (tx) => {
    await lockSeason(tx, id);
    const season = await getSeasonOrThrow(id, tx);
    if (season.status === status) return season;
    if (!TRANSITIONS[season.status].includes(status)) {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot move a season from ${season.status} to ${status}`);
    }
    if (season.status === 'AUCTION') {
      const live = await tx.auction.findFirst({ where: { seasonId: id, status: 'LIVE' } });
      if (live) throw conflict('AUCTION_LIVE', 'End the live auction before changing the season status');
    }
    const data = { status };
    if (status === 'COMPLETED') {
      let champ = championTeamId;
      if (!champ) {
        const top = await tx.teamStanding.findFirst({ where: { seasonId: id }, orderBy: [{ points: 'desc' }, { netRunRate: 'desc' }] });
        champ = top?.teamId;
      }
      data.championTeamId = champ ?? null;
      data.endDate = season.endDate ?? new Date();
    }
    if (status === 'RUNNING' && season.status === 'COMPLETED') data.championTeamId = null;
    const updated = await tx.season.update({ where: { id }, data });
    await audit(tx, { userId: actor.id, action: 'SEASON_STATUS_CHANGED', entity: 'Season', entityId: id, seasonId: id, metadata: { from: season.status, to: status } });
    return updated;
  });
}
