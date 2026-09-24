// Tiny module so services can publish events without importing the Socket.IO server.
let io = null;

export const setIO = (instance) => { io = instance; };

export const seasonRoom = (seasonId) => `season:${seasonId}`;
export const matchRoom = (matchId) => `match:${matchId}`;

export function publish(room, event, payload) {
  if (io) io.to(room).emit(event, payload);
}
