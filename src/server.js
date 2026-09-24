import http from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { initSockets } from './sockets/index.js';
import { prisma } from './utils/prisma.js';

const app = createApp();
const server = http.createServer(app);
initSockets(server);

server.listen(env.port, () => console.log(`Alkaran Bulls API listening on :${env.port} (${env.isProd ? 'production' : 'development'})`));

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
