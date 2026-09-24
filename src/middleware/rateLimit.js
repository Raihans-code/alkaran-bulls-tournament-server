import rateLimit from 'express-rate-limit';

const message = { success: false, message: 'Too many requests, please slow down', error: 'RATE_LIMITED' };

export const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false, message });
export const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, message });
