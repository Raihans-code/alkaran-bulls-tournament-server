import { prisma } from './prisma.js';

/** Write an audit log entry. Pass a transaction client as `db` to make it atomic with the action. */
export async function audit(db, { userId, action, entity, entityId, seasonId, metadata }) {
  const client = db || prisma;
  try {
    await client.auditLog.create({
      data: { userId: userId || null, action, entity, entityId: entityId || null, seasonId: seasonId || null, metadata: metadata ?? undefined },
    });
  } catch (err) {
    // Auditing must never break the main flow when outside a transaction.
    if (client === prisma) console.error('[audit] failed', err.message);
    else throw err;
  }
}
