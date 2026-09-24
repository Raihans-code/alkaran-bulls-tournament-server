import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors.js';

export const notFoundHandler = (req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found`, error: 'NOT_FOUND' });

export function toErrorPayload(err) {
  if (err instanceof AppError) return { status: err.status, message: err.message, error: err.code, details: err.details };
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return { status: 400, message: details[0] ? `${details[0].path || 'input'}: ${details[0].message}` : 'Invalid input', error: 'VALIDATION_ERROR', details };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return { status: 409, message: 'A record with these details already exists', error: 'DUPLICATE' };
    if (err.code === 'P2025') return { status: 404, message: 'Record not found', error: 'NOT_FOUND' };
    if (err.code === 'P2003') return { status: 409, message: 'This record is referenced by other data', error: 'IN_USE' };
  }
  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return { status: 401, message: 'Session expired, please log in again', error: 'INVALID_TOKEN' };
  }
  if (err?.type === 'entity.parse.failed') return { status: 400, message: 'Malformed JSON body', error: 'BAD_JSON' };
  console.error('[error]', err);
  return { status: 500, message: 'Something went wrong on our side', error: 'INTERNAL_ERROR' };
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  const { status, message, error, details } = toErrorPayload(err);
  res.status(status).json({ success: false, message, error, ...(details ? { details } : {}) });
}
