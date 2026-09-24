import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../utils/prisma.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export async function userFromToken(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw unauthorized('Account not found or disabled');
  return user;
}

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized();
    req.user = await userFromToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(forbidden());

export const requireAdmin = requireRole('ADMIN');
export const requireOwner = requireRole('OWNER', 'ADMIN');
