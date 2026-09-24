import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../utils/prisma.js';
import { conflict, unauthorized } from '../utils/errors.js';
import { audit } from '../utils/audit.js';

export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, canScore: u.canScore, isActive: u.isActive, createdAt: u.createdAt,
});

const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export async function register({ name, email, password, phone }) {
  if (await prisma.user.findUnique({ where: { email } })) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
  const passwordHash = await bcrypt.hash(password, 12);
  // Role is never taken from the client: self-registration always creates a normal USER.
  const user = await prisma.user.create({ data: { name, email, phone: phone || null, passwordHash, role: 'USER' } });
  await audit(null, { userId: user.id, action: 'USER_REGISTERED', entity: 'User', entityId: user.id });
  return { user: publicUser(user), token: signToken(user) };
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Same message for unknown email / wrong password to avoid account enumeration.
  const valid = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  return { user: publicUser(user), token: signToken(user) };
}
