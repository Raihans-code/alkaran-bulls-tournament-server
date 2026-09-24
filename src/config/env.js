import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET || (isProd && process.env.JWT_SECRET.startsWith('change-me'))) {
  if (isProd) throw new Error('JWT_SECRET must be set to a strong random value in production');
  console.warn('[env] JWT_SECRET missing - using an insecure development default');
}

export const env = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
