import { prisma } from '../utils/prisma.js';
import { AppError, conflict, forbidden, notFound } from '../utils/errors.js';
import { audit } from '../utils/audit.js';
import { lockSeason } from '../utils/lock.js';
import { assertSeasonWritable } from '../utils/seasonGuard.js';
import { getSeasonOrThrow } from './seasonService.js';
import { publish, seasonRoom } from '../sockets/emitter.js';

const teamInclude = {
  owner: { select: { id: true, name: true, email: true, phone: true } },
  squad: { select: { price: true } },
};

export function shapeTeam(team, maxPlayers) {
  const { squad, ...rest } = team;
  return {
    ...rest,
    squadCount: squad.length,
    totalSpent: squad.reduce((n, s) => n + s.price, 0),
    maxPlayers,
    squadFull: maxPlayers ? squad.length >= maxPlayers : undefined,
  };
}

export async function listTeams({ seasonId, status }) {
  const season = await getSeasonOrThrow(seasonId);
  const teams = await prisma.team.findMany({
    where: { seasonId, ...(status ? { registrationStatus: status } : {}) },
    include: teamInclude,
    orderBy: { createdAt: 'asc' },
  });
  return teams.map((t) => shapeTeam(t, season.maxPlayersPerTeam));
}

export async function myTeams(user, seasonId) {
  const teams = await prisma.team.findMany({
    where: { ownerId: user.id, ...(seasonId ? { seasonId } : {}) },
    include: { ...teamInclude, season: { select: { id: true, name: true, status: true, maxPlayersPerTeam: true, bidIncrement: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return teams.map((t) => ({ ...shapeTeam(t, t.season.maxPlayersPerTeam) }));
}

export async function getTeam(id) {
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      season: { select: { id: true, name: true, status: true, maxPlayersPerTeam: true } },
      squad: { include: { player: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!team) throw notFound('Team');
  const { squad, ...rest } = team;
  return {
    ...rest,
    squadCount: squad.length,
    totalSpent: squad.reduce((n, s) => n + s.price, 0),
    maxPlayers: team.season.maxPlayersPerTeam,
    squadFull: squad.length >= team.season.maxPlayersPerTeam,
    squad: squad.map((s) => ({ id: s.id, price: s.price, player: s.player })),
  };
}

export async function registerTeam(user, { seasonId, name, logo, contactInfo }) {
  return prisma.$transaction(async (tx) => {
    await lockSeason(tx, seasonId);
    const season = await getSeasonOrThrow(seasonId, tx);
    if (season.status !== 'REGISTRATION') throw new AppError(409, 'REGISTRATION_CLOSED', 'Team registration is not open for this season');

    const active = await tx.team.findMany({ where: { seasonId, registrationStatus: { not: 'REJECTED' } }, select: { ownerId: true, name: true } });
    if (active.length >= season.maxTeams) throw new AppError(409, 'SEASON_FULL', `This season already has ${season.maxTeams} teams`);
    if (!season.allowMultipleTeamsPerUser && active.some((t) => t.ownerId === user.id)) {
      throw conflict('TEAM_ALREADY_REGISTERED', 'You already registered a team for this season');
    }
    if (active.some((t) => t.name.toLowerCase() === name.toLowerCase())) throw conflict('TEAM_NAME_TAKEN', 'That team name is already taken in this season');

    const team = await tx.team.create({
      data: { name, logo, contactInfo: contactInfo || null, ownerId: user.id, seasonId, purse: season.initialTeamBudget },
    });
    await audit(tx, { userId: user.id, action: 'TEAM_REGISTERED', entity: 'Team', entityId: team.id, seasonId, metadata: { name } });
    return team;
  });
}

export async function updateTeam(actor, id, data) {
  const team = await prisma.team.findUnique({ where: { id }, include: { season: true } });
  if (!team) throw notFound('Team');
  if (actor.role !== 'ADMIN' && team.ownerId !== actor.id) throw forbidden('You can only edit your own team');
  assertSeasonWritable(team.season, { actor, correction: true });
  if (data.name && data.name.toLowerCase() !== team.name.toLowerCase()) {
    const dup = await prisma.team.findFirst({ where: { seasonId: team.seasonId, name: { equals: data.name, mode: 'insensitive' }, id: { not: id } } });
    if (dup) throw conflict('TEAM_NAME_TAKEN', 'That team name is already taken in this season');
  }
  // purse / status / owner are deliberately NOT editable here.
  const updated = await prisma.team.update({ where: { id }, data: { name: data.name, logo: data.logo, contactInfo: data.contactInfo } });
  await audit(null, { userId: actor.id, action: 'TEAM_UPDATED', entity: 'Team', entityId: id, seasonId: team.seasonId });
  return updated;
}

export async function setRegistration(actor, id, status) {
  const result = await prisma.$transaction(async (tx) => {
    const team = await tx.team.findUnique({ where: { id } });
    if (!team) throw notFound('Team');
    await lockSeason(tx, team.seasonId);
    const season = await getSeasonOrThrow(team.seasonId, tx);
    assertSeasonWritable(season, { actor });
    if (status === 'APPROVED') {
      const approved = await tx.team.count({ where: { seasonId: season.id, registrationStatus: 'APPROVED', id: { not: id } } });
      if (approved >= season.maxTeams) throw new AppError(409, 'SEASON_FULL', `Season already has ${season.maxTeams} approved teams`);
    }
    if (status !== 'APPROVED') {
      const inMatchOrSquad = (await tx.squadPlayer.count({ where: { teamId: id } })) + (await tx.match.count({ where: { OR: [{ teamAId: id }, { teamBId: id }] } }));
      if (inMatchOrSquad > 0) throw conflict('TEAM_IN_USE', 'Team already has players or matches and cannot be un-approved');
    }
    const updated = await tx.team.update({ where: { id }, data: { registrationStatus: status } });
    if (status === 'APPROVED') {
      await tx.teamStanding.upsert({ where: { teamId: id }, update: {}, create: { teamId: id, seasonId: season.id } });
    } else {
      await tx.teamStanding.deleteMany({ where: { teamId: id } });
    }
    await audit(tx, { userId: actor.id, action: status === 'APPROVED' ? 'TEAM_APPROVED' : `TEAM_${status}`, entity: 'Team', entityId: id, seasonId: season.id, metadata: { name: team.name } });
    return updated;
  });
  publish(seasonRoom(result.seasonId), 'teams:update', { seasonId: result.seasonId });
  return result;
}

export async function adjustPurse(actor, id, { purse, reason }) {
  const result = await prisma.$transaction(async (tx) => {
    const team = await tx.team.findUnique({ where: { id } });
    if (!team) throw notFound('Team');
    await lockSeason(tx, team.seasonId);
    const fresh = await tx.team.findUnique({ where: { id } });
    const updated = await tx.team.update({ where: { id }, data: { purse } });
    await audit(tx, { userId: actor.id, action: 'PURSE_ADJUSTED', entity: 'Team', entityId: id, seasonId: team.seasonId, metadata: { from: fresh.purse, to: purse, reason } });
    return updated;
  });
  publish(seasonRoom(result.seasonId), 'teams:update', { seasonId: result.seasonId });
  return result;
}
