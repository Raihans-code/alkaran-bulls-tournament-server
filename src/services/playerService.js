import { prisma } from '../utils/prisma.js';
import { AppError, conflict, notFound } from '../utils/errors.js';
import { audit } from '../utils/audit.js';
import { assertSeasonWritable } from '../utils/seasonGuard.js';
import { getSeasonOrThrow } from './seasonService.js';

const csvCell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;

export async function listPlayers({ seasonId, status, category, q }) {
  return prisma.player.findMany({
    where: { seasonId, ...(status && { status }), ...(category && { category }), ...(q && { name: { contains: q, mode: 'insensitive' } }) },
    include: { currentTeam: { select: { id: true, name: true, logo: true } } },
    orderBy: [{ basePrice: 'desc' }, { name: 'asc' }],
  });
}

export async function getPlayer(id) {
  const player = await prisma.player.findUnique({
    where: { id },
    include: {
      currentTeam: { select: { id: true, name: true } },
      auctions: {
        orderBy: { startedAt: 'desc' },
        include: { bids: { orderBy: { createdAt: 'asc' }, include: { team: { select: { id: true, name: true } } } }, highestBidTeam: { select: { id: true, name: true } } },
      },
    },
  });
  if (!player) throw notFound('Player');
  return player;
}

async function assertNameFree(seasonId, name, exceptId) {
  const dup = await prisma.player.findFirst({ where: { seasonId, name: { equals: name, mode: 'insensitive' }, ...(exceptId && { id: { not: exceptId } }) } });
  if (dup) throw conflict('DUPLICATE_PLAYER', `"${name}" is already registered in this season`);
}

export async function createPlayer(actor, data) {
  const season = await getSeasonOrThrow(data.seasonId);
  assertSeasonWritable(season, { actor });
  await assertNameFree(data.seasonId, data.name);
  const player = await prisma.player.create({ data });
  await audit(null, { userId: actor.id, action: 'PLAYER_ADDED', entity: 'Player', entityId: player.id, seasonId: season.id, metadata: { name: player.name } });
  return player;
}

export async function updatePlayer(actor, id, data) {
  const player = await prisma.player.findUnique({ where: { id }, include: { season: true } });
  if (!player) throw notFound('Player');
  assertSeasonWritable(player.season, { actor });
  if (['IN_AUCTION', 'SOLD'].includes(player.status) && data.basePrice !== undefined && data.basePrice !== player.basePrice) {
    throw new AppError(409, 'PLAYER_LOCKED', 'Base price cannot change while a player is in auction or sold');
  }
  if (data.name) await assertNameFree(player.seasonId, data.name, id);
  const updated = await prisma.player.update({ where: { id }, data });
  await audit(null, { userId: actor.id, action: 'PLAYER_UPDATED', entity: 'Player', entityId: id, seasonId: player.seasonId });
  return updated;
}

export async function deletePlayer(actor, id) {
  const player = await prisma.player.findUnique({ where: { id }, include: { season: true, _count: { select: { auctions: true } } } });
  if (!player) throw notFound('Player');
  assertSeasonWritable(player.season, { actor });
  if (player._count.auctions > 0 || player.status !== 'AVAILABLE') {
    throw new AppError(409, 'PLAYER_IN_USE', 'Players involved in an auction cannot be deleted');
  }
  await prisma.player.delete({ where: { id } });
  await audit(null, { userId: actor.id, action: 'PLAYER_DELETED', entity: 'Player', entityId: id, seasonId: player.seasonId, metadata: { name: player.name } });
}

export async function importPlayers(actor, { seasonId, players }) {
  const season = await getSeasonOrThrow(seasonId);
  assertSeasonWritable(season, { actor });
  const existing = new Set((await prisma.player.findMany({ where: { seasonId }, select: { name: true } })).map((p) => p.name.toLowerCase()));
  const toCreate = [];
  const skipped = [];
  for (const p of players) {
    const key = p.name.toLowerCase();
    if (existing.has(key)) { skipped.push(p.name); continue; }
    existing.add(key);
    toCreate.push({ ...p, seasonId });
  }
  if (toCreate.length) await prisma.player.createMany({ data: toCreate });
  await audit(null, { userId: actor.id, action: 'PLAYERS_IMPORTED', entity: 'Player', seasonId, metadata: { created: toCreate.length, skipped: skipped.length } });
  return { created: toCreate.length, skipped };
}

export async function exportPlayersCsv(seasonId) {
  const players = await listPlayers({ seasonId });
  const rows = [['Name', 'Category', 'BasePrice', 'Status', 'Team', 'SoldPrice', 'Phone']];
  for (const p of players) rows.push([p.name, p.category, p.basePrice, p.status, p.currentTeam?.name ?? '', p.soldPrice ?? '', p.phone ?? '']);
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}
