import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../utils/prisma.js';
import { badRequest, conflict, unauthorized } from '../utils/errors.js';
import { audit } from '../utils/audit.js';

export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, canScore: u.canScore, isActive: u.isActive, mustChangePassword: u.mustChangePassword, createdAt: u.createdAt,
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


export async function requestPasswordReset({ email, reason }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return { message: 'If an active account exists with this email, a password recovery request has been submitted.' };
  }

  const existing = await prisma.passwordResetRequest.findFirst({
    where: { userId: user.id, status: 'PENDING' },
  });
  if (existing) return { message: 'A password recovery request is already pending for this account.' };

  await prisma.passwordResetRequest.create({
    data: { userId: user.id, reason: reason || null },
  });

  await audit(null, { userId: user.id, action: 'PASSWORD_RESET_REQUESTED', entity: 'PasswordResetRequest', entityId: user.id });
  return { message: 'Password recovery request submitted for admin approval.' };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized('Account not found');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw unauthorized('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
  if (currentPassword === newPassword) throw badRequest('PASSWORD_UNCHANGED', 'New password must be different from your current password');

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });

  await prisma.passwordResetRequest.updateMany({
    where: { userId, status: 'APPROVED' },
    data: { status: 'USED' },
  });

  await audit(null, { userId, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId });
  return { user: publicUser(updated) };
}
