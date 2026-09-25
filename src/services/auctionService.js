import { prisma } from '../utils/prisma.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { audit } from '../utils/audit.js';
import { lockSeason } from '../utils/lock.js';
import { assertSeasonWritable } from '../utils/seasonGuard.js';
import { publish, seasonRoom } from '../sockets/emitter.js';

const TX_OPTS = { maxWait: 5000, timeout: 10000 };

const bidView = (b) => ({ id: b.id, teamId: b.teamId, teamName: b.team?.name, amount: b.amount, createdAt: b.createdAt });

/** Authoritative auction snapshot for a season. Every client renders this and nothing else. */
export async function getAuctionState(seasonId, db = prisma) {
  const season = await db.season.findUnique({ where: { id: seasonId } });
  if (!season) throw notFound('Season');
  const live = await db.auction.findFirst({
    where: { seasonId, status: 'LIVE' },
    include: {
      player: true,
      highestBidTeam: { select: { id: true, name: true, logo: true } },
      bids: { orderBy: { createdAt: 'desc' }, take: 40, include: { team: { select: { name: true } } } },
    },
  });
  const last = await db.auction.findFirst({
    where: { seasonId, status: { in: ['SOLD', 'UNSOLD', 'WITHDRAWN', 'CANCELLED'] } },
    orderBy: { endedAt: 'desc' },
    include: { player: { select: { id: true, name: true, image: true } }, highestBidTeam: { select: { id: true, name: true } } },
  });
  return {
    seasonId,
    seasonStatus: season.status,
    isLive: !!live,
    bidIncrement: season.bidIncrement,
    bidOptions: season.bidOptions?.length === 4 ? season.bidOptions : [season.bidIncrement],
    maxPlayersPerTeam: season.maxPlayersPerTeam,
    nextBid: live ? live.currentBid + Math.min(...(season.bidOptions?.length === 4 ? season.bidOptions : [season.bidIncrement])) : null,
    auction: live && {
      id: live.id,
      version: live.version,
      basePrice: live.basePrice,
      currentBid: live.currentBid,
      startedAt: live.startedAt,
      highestBidTeam: live.highestBidTeam,
      player: live.player,
      bids: live.bids.map(bidView),
    },
    lastResult: last && {
      status: last.status,
      player: last.player,
      team: last.highestBidTeam,
      price: last.status === 'SOLD' ? last.currentBid : null,
      endedAt: last.endedAt,
    },
  };
}

async function emit(seasonId, event, extra = {}) {
  const state = await getAuctionState(seasonId);
  const payload = { event, state, ...extra };
  publish(seasonRoom(seasonId), event, payload);
  publish(seasonRoom(seasonId), 'auction:state', payload);
  return state;
}

async function requireLive(tx, seasonId) {
  const live = await tx.auction.findFirst({ where: { seasonId, status: 'LIVE' }, include: { player: true } });
  if (!live) throw new AppError(409, 'AUCTION_NOT_LIVE', 'There is no live auction right now');
  return live;
}

export async function startAuction(actor, { seasonId, playerId }) {
  await prisma.$transaction(async (tx) => {
    await lockSeason(tx, seasonId);
    const season = await tx.season.findUnique({ where: { id: seasonId } });
    if (!season) throw notFound('Season');
    assertSeasonWritable(season, { actor });
    if (season.status !== 'AUCTION') throw new AppError(409, 'SEASON_NOT_IN_AUCTION', 'Move the season to the AUCTION stage before starting an auction');
    if (await tx.auction.findFirst({ where: { seasonId, status: 'LIVE' } })) throw conflict('AUCTION_ALREADY_LIVE', 'Another player is already being auctioned');
    const approved = await tx.team.count({ where: { seasonId, registrationStatus: 'APPROVED' } });
    if (approved === 0) throw badRequest('NO_APPROVED_TEAMS', 'Approve at least one team before starting the auction');

    const player = await tx.player.findUnique({ where: { id: playerId } });
    if (!player || player.seasonId !== seasonId) throw notFound('Player');
    if (player.status === 'SOLD') throw conflict('PLAYER_ALREADY_SOLD', 'This player is already sold. Reset the player first to auction again');
    if (!['AVAILABLE', 'UNSOLD'].includes(player.status)) throw conflict('PLAYER_NOT_AVAILABLE', `Player is ${player.status.toLowerCase()} and cannot be auctioned. Reset the player first`);

    const auction = await tx.auction.create({ data: { seasonId, playerId, basePrice: player.basePrice, currentBid: player.basePrice } });
    await tx.player.update({ where: { id: playerId }, data: { status: 'IN_AUCTION' } });
    await audit(tx, { userId: actor.id, action: 'AUCTION_STARTED', entity: 'Auction', entityId: auction.id, seasonId, metadata: { player: player.name, basePrice: player.basePrice } });
  }, TX_OPTS);
  return emit(seasonId, 'auction:start');
}

export async function placeBid(user, { seasonId, amount, teamId }) {
  if (!['OWNER', 'ADMIN'].includes(user.role)) throw forbidden('Only team owners can place bids', 'OWNER_ROLE_REQUIRED');
  const bid = await prisma.$transaction(async (tx) => {
    await lockSeason(tx, seasonId); // serialises concurrent bids: the DB decides who is first
    const season = await tx.season.findUnique({ where: { id: seasonId } });
    if (!season) throw notFound('Season');
    if (season.status !== 'AUCTION') throw new AppError(409, 'AUCTION_NOT_LIVE', 'The auction is not open for this season');
    const live = await requireLive(tx, seasonId);

    // Owners may bid only for their own teams; admins may select any approved team.
    const owned = await tx.team.findMany({ where: { seasonId, ...(user.role === 'ADMIN' ? {} : { ownerId: user.id }), registrationStatus: 'APPROVED' } });
    if (owned.length === 0) throw forbidden('You need an approved team in this season to bid', 'NO_APPROVED_TEAM');
    let team;
    if (teamId) {
      team = owned.find((t) => t.id === teamId);
      if (!team) throw forbidden(user.role === 'ADMIN' ? 'That team is not approved for this season' : 'You can only bid for your own team', 'NOT_TEAM_OWNER');
    } else if (owned.length === 1) team = owned[0];
    else throw badRequest('TEAM_REQUIRED', 'Select which of your teams is bidding');

    const squadCount = await tx.squadPlayer.count({ where: { teamId: team.id } });
    if (squadCount >= season.maxPlayersPerTeam) throw new AppError(409, 'SQUAD_FULL', `Team squad is already full (${season.maxPlayersPerTeam} players)`);
    if (live.highestBidTeamId === team.id) throw conflict('ALREADY_HIGHEST_BIDDER', 'Your team already holds the highest bid');

    const options = season.bidOptions?.length === 4 ? season.bidOptions : [season.bidIncrement];
    const minimum = live.currentBid + Math.min(...options);
    if (amount < minimum) throw new AppError(409, 'BID_TOO_LOW', `Bid must be at least ${minimum}`, { minimum, currentBid: live.currentBid });
    const increment = amount - live.currentBid;
    if (!options.includes(increment)) {
      throw badRequest('INVALID_INCREMENT', `Choose one of the configured bid options: ${options.join(', ')}`, { options });
    }
    if (team.purse < amount) throw new AppError(409, 'INSUFFICIENT_PURSE', 'Not enough purse for this bid', { purse: team.purse });

    const created = await tx.auctionBid.create({ data: { auctionId: live.id, teamId: team.id, amount }, include: { team: { select: { name: true } } } });
    await tx.auction.update({ where: { id: live.id }, data: { currentBid: amount, highestBidTeamId: team.id, version: { increment: 1 } } });
    await audit(tx, { userId: user.id, action: 'BID_PLACED', entity: 'AuctionBid', entityId: created.id, seasonId, metadata: { team: team.name, amount, player: live.player.name } });
    return bidView(created);
  }, TX_OPTS);
  const state = await emit(seasonId, 'auction:bid', { bid });
  return { bid, state };
}

export async function markSold(actor, { seasonId }) {
  const result = await prisma.$transaction(async (tx) => {
    await lockSeason(tx, seasonId);
    const live = await requireLive(tx, seasonId);
    const season = await tx.season.findUnique({ where: { id: seasonId } });
    if (!live.highestBidTeamId) throw badRequest('NO_BIDS', 'Nobody has bid on this player. Mark UNSOLD or WITHDRAW instead');

    const team = await tx.team.findUnique({ where: { id: live.highestBidTeamId } });
    const squadCount = await tx.squadPlayer.count({ where: { teamId: team.id } });
    if (squadCount >= season.maxPlayersPerTeam) throw new AppError(409, 'SQUAD_FULL', `${team.name} already has a full squad`);

    // Atomic guard against negative purse: only deducts if the purse still covers the price.
    const deducted = await tx.team.updateMany({ where: { id: team.id, purse: { gte: live.currentBid } }, data: { purse: { decrement: live.currentBid } } });
    if (deducted.count !== 1) throw new AppError(409, 'INSUFFICIENT_PURSE', `${team.name} no longer has enough purse`);

    await tx.squadPlayer.create({ data: { seasonId, teamId: team.id, playerId: live.playerId, price: live.currentBid } });
    await tx.player.update({ where: { id: live.playerId }, data: { status: 'SOLD', currentTeamId: team.id, soldPrice: live.currentBid } });
    await tx.auction.update({ where: { id: live.id }, data: { status: 'SOLD', endedAt: new Date(), version: { increment: 1 } } });
    await audit(tx, { userId: actor.id, action: 'PLAYER_SOLD', entity: 'Auction', entityId: live.id, seasonId, metadata: { player: live.player.name, team: team.name, price: live.currentBid } });
    return { status: 'SOLD', player: { id: live.playerId, name: live.player.name }, team: { id: team.id, name: team.name }, price: live.currentBid };
  }, TX_OPTS);
  const state = await emit(seasonId, 'auction:sold', { result });
  publish(seasonRoom(seasonId), 'teams:update', { seasonId });
  return { result, state };
}

async function closeWithoutSale(actor, seasonId, { auctionStatus, playerStatus, event, action }) {
  const result = await prisma.$transaction(async (tx) => {
    await lockSeason(tx, seasonId);
    const live = await requireLive(tx, seasonId);
    await tx.player.update({ where: { id: live.playerId }, data: { status: playerStatus, currentTeamId: null, soldPrice: null } });
    await tx.auction.update({ where: { id: live.id }, data: { status: auctionStatus, endedAt: new Date(), version: { increment: 1 } } });
    await audit(tx, { userId: actor.id, action, entity: 'Auction', entityId: live.id, seasonId, metadata: { player: live.player.name, lastBid: live.currentBid } });
    return { status: auctionStatus, player: { id: live.playerId, name: live.player.name } };
  }, TX_OPTS);
  const state = await emit(seasonId, event, { result });
  return { result, state };
}

export const markUnsold = (actor, { seasonId }) => closeWithoutSale(actor, seasonId, { auctionStatus: 'UNSOLD', playerStatus: 'UNSOLD', event: 'auction:unsold', action: 'PLAYER_UNSOLD' });
export const withdrawPlayer = (actor, { seasonId }) => closeWithoutSale(actor, seasonId, { auctionStatus: 'WITHDRAWN', playerStatus: 'WITHDRAWN', event: 'auction:withdraw', action: 'PLAYER_WITHDRAWN' });
// Cancel keeps the recorded bids as history but puts the player back in the pool.
export const cancelAuction = (actor, { seasonId }) => closeWithoutSale(actor, seasonId, { auctionStatus: 'CANCELLED', playerStatus: 'AVAILABLE', event: 'auction:end', action: 'AUCTION_CANCELLED' });

/** Admin-only: put a SOLD / UNSOLD / WITHDRAWN player back into the pool (refunds the team if sold). */
export async function resetPlayer(actor, { playerId }) {
  const seasonId = (await prisma.player.findUnique({ where: { id: playerId }, select: { seasonId: true } }))?.seasonId;
  if (!seasonId) throw notFound('Player');
  await prisma.$transaction(async (tx) => {
    await lockSeason(tx, seasonId);
    const season = await tx.season.findUnique({ where: { id: seasonId } });
    assertSeasonWritable(season, { actor });
    const player = await tx.player.findUnique({ where: { id: playerId }, include: { squadEntry: true } });
    if (player.status === 'IN_AUCTION') throw conflict('PLAYER_IN_AUCTION', 'Cancel the live auction first');
    if (player.status === 'AVAILABLE') return;
    if (player.squadEntry) {
      await tx.team.update({ where: { id: player.squadEntry.teamId }, data: { purse: { increment: player.squadEntry.price } } });
      await tx.squadPlayer.delete({ where: { id: player.squadEntry.id } });
    }
    await tx.player.update({ where: { id: playerId }, data: { status: 'AVAILABLE', currentTeamId: null, soldPrice: null } });
    await audit(tx, { userId: actor.id, action: 'PLAYER_RESET', entity: 'Player', entityId: playerId, seasonId, metadata: { name: player.name, previous: player.status, refunded: player.squadEntry?.price ?? 0 } });
  }, TX_OPTS);
  publish(seasonRoom(seasonId), 'teams:update', { seasonId });
  return emit(seasonId, 'auction:state');
}

/** Finished auctions with every bid (season-scoped). */
export async function auctionHistory({ seasonId, playerId }) {
  const auctions = await prisma.auction.findMany({
    where: { seasonId, status: { not: 'LIVE' }, ...(playerId && { playerId }) },
    orderBy: { endedAt: 'desc' },
    include: {
      player: { select: { id: true, name: true, category: true, image: true } },
      highestBidTeam: { select: { id: true, name: true } },
      bids: { orderBy: { createdAt: 'asc' }, include: { team: { select: { name: true } } } },
    },
  });
  return auctions.map((a) => ({ ...a, bids: a.bids.map(bidView) }));
}
