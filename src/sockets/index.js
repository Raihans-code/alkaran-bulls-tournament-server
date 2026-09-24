import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { userFromToken } from '../middleware/auth.js';
import { toErrorPayload } from '../middleware/errorHandler.js';
import { AppError } from '../utils/errors.js';
import { bidSchema } from '../validators/auction.js';
import { placeBid, getAuctionState } from '../services/auctionService.js';
import { getScoreboard } from '../services/matchService.js';
import { setIO, seasonRoom, matchRoom } from './emitter.js';

const uuidOk = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

// Every handler answers through an ack callback: { success, data } or { success:false, message, error }.
const guard = (handler) => async (payload, ack) => {
  const reply = typeof ack === 'function' ? ack : () => {};
  try {
    reply({ success: true, data: await handler(payload) });
  } catch (err) {
    const { message, error, details } = toErrorPayload(err);
    reply({ success: false, message, error, details });
  }
};

export function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: env.clientOrigins, credentials: true } });
  setIO(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.data.user = token ? await userFromToken(token) : null;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    // Rate-limit bid spam per socket: at most 6 bid events per second.
    let bucket = 6;
    const refill = setInterval(() => { bucket = 6; }, 1000);
    socket.on('disconnect', () => clearInterval(refill));

    socket.on('season:join', guard(async ({ seasonId }) => {
      if (!uuidOk(seasonId)) throw new Error('bad season');
      socket.join(seasonRoom(seasonId));
      return getAuctionState(seasonId);
    }));
    socket.on('season:leave', ({ seasonId } = {}) => uuidOk(seasonId) && socket.leave(seasonRoom(seasonId)));

    socket.on('match:join', guard(async ({ matchId }) => {
      if (!uuidOk(matchId)) throw new Error('bad match');
      socket.join(matchRoom(matchId));
      return getScoreboard(matchId);
    }));
    socket.on('match:leave', ({ matchId } = {}) => uuidOk(matchId) && socket.leave(matchRoom(matchId)));

    // Bidding: the client only sends an intent (season + amount). Identity and team come from the verified JWT.
    socket.on('auction:bid', guard(async (payload) => {
      if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Sign in to place a bid');
      if (bucket-- <= 0) throw new AppError(429, 'RATE_LIMITED', 'Too many bids, slow down');
      const input = bidSchema.parse(payload);
      return placeBid(user, input);
    }));
  });
  return io;
}
