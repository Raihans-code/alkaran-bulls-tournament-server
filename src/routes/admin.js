import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { auditQuery, updateUserSchema } from '../validators/admin.js';
import * as c from '../controllers/adminController.js';

const r = Router();
r.use(authenticate, requireAdmin);
r.get('/overview', validate(z.object({ seasonId: z.string().uuid().optional() }), 'query'), c.overview);
r.get('/audit-logs', validate(auditQuery, 'query'), c.auditLogs);
r.get('/users', c.users);
r.patch('/users/:id', validate(idParam, 'params'), validate(updateUserSchema), c.updateUser);
export default r;
