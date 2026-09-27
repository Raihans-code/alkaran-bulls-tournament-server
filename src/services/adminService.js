import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../utils/prisma.js';
import { AppError, notFound } from '../utils/errors.js';
import { audit } from '../utils/audit.js';
import { publicUser } from './authService.js';

export async function overview(seasonId) {
  const season = seasonId
    ? await prisma.season.findUnique({ where: { id: seasonId } })
    : await prisma.season.findFirst({ where: { status: { in: ['REGISTRATION', 'AUCTION', 'RUNNING', 'UPCOMING'] } }, orderBy: { seasonNumber: 'desc' } }) ??
      (await prisma.season.findFirst({ orderBy: { seasonNumber: 'desc' } }));
  if (!season) return { season: null };
  const id = season.id;
  const [teams, approved, players, sold, unsold, live, matches, liveMatches, users] = await Promise.all([
    prisma.team.count({ where: { seasonId: id } }),
    prisma.team.count({ where: { seasonId: id, registrationStatus: 'APPROVED' } }),
    prisma.player.count({ where: { seasonId: id } }),
    prisma.player.count({ where: { seasonId: id, status: 'SOLD' } }),
    prisma.player.count({ where: { seasonId: id, status: 'UNSOLD' } }),
    prisma.auction.findFirst({ where: { seasonId: id, status: 'LIVE' }, include: { player: { select: { name: true } } } }),
    prisma.match.count({ where: { seasonId: id, status: 'COMPLETED' } }),
    prisma.match.count({ where: { seasonId: id, status: 'LIVE' } }),
    prisma.user.count(),
  ]);
  const pending = teams - approved - (await prisma.team.count({ where: { seasonId: id, registrationStatus: 'REJECTED' } }));
  return { season, counts: { teams, approved, pending, players, sold, unsold, matchesPlayed: matches, liveMatches, users }, currentAuction: live ? { player: live.player.name, currentBid: live.currentBid } : null };
}

export async function listAuditLogs({ seasonId, entity, page, pageSize }) {
  const where = { ...(seasonId && { seasonId }), ...(entity && { entity }) };
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { user: { select: { name: true, email: true } } } }),
  ]);
  return { items, total, page, pageSize };
}

export async function listUsers() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { teams: true } } } });
  return users.map((u) => ({ ...publicUser(u), teams: u._count.teams }));
}

export async function updateUser(actor, id, data) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('User');
  if (id === actor.id && ((data.role !== undefined && data.role !== 'ADMIN') || data.isActive === false)) {
    throw new AppError(409, 'CANNOT_LOCK_SELF_OUT', 'You cannot remove your own admin access or disable your own account');
  }
  const updated = await prisma.user.update({ where: { id }, data });
  await audit(null, { userId: actor.id, action: 'USER_UPDATED', entity: 'User', entityId: id, metadata: data });
  return publicUser(updated);
}


export async function listPasswordResetRequests() {
  return prisma.passwordResetRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true, phone: true, isActive: true } } },
  });
}

export async function approvePasswordReset(actor, requestId) {
  const request = await prisma.passwordResetRequest.findUnique({ where: { id: requestId }, include: { user: true } });
  if (!request) throw notFound('Password reset request');
  if (request.status !== 'PENDING') throw new AppError(409, 'RESET_REQUEST_NOT_PENDING', 'This password recovery request is no longer pending');
  if (!request.user.isActive) throw new AppError(409, 'USER_INACTIVE', 'This user account is disabled');

  const temporaryPassword = `AB-${crypto.randomBytes(9).toString('base64url')}`;
  const temporaryPasswordHash = await bcrypt.hash(temporaryPassword, 12);

  await prisma.$transaction([
    prisma.passwordResetRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', temporaryPasswordHash, approvedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: request.userId },
      data: { passwordHash: temporaryPasswordHash, mustChangePassword: true },
    }),
  ]);

  await audit(null, { userId: actor.id, action: 'PASSWORD_RESET_APPROVED', entity: 'PasswordResetRequest', entityId: requestId });
  return { requestId, user: { id: request.user.id, name: request.user.name, email: request.user.email }, temporaryPassword };
}

export async function rejectPasswordReset(actor, requestId) {
  const request = await prisma.passwordResetRequest.findUnique({ where: { id: requestId } });
  if (!request) throw notFound('Password reset request');
  if (request.status !== 'PENDING') throw new AppError(409, 'RESET_REQUEST_NOT_PENDING', 'This password recovery request is no longer pending');
  const updated = await prisma.passwordResetRequest.update({ where: { id: requestId }, data: { status: 'REJECTED' } });
  await audit(null, { userId: actor.id, action: 'PASSWORD_RESET_REJECTED', entity: 'PasswordResetRequest', entityId: requestId });
  return updated;
}
