import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimit.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/auth.js';
import * as c from '../controllers/authController.js';

const r = Router();
r.post('/register', authLimiter, validate(registerSchema), c.register);
r.post('/login', authLimiter, validate(loginSchema), c.login);
r.get('/me', authenticate, c.me);
export default r;
