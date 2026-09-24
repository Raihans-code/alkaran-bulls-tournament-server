import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { updateUserSchema } from '../validators/admin.js';
import * as c from '../controllers/adminController.js';

const r = Router();
r.use(authenticate, requireAdmin);
r.get('/', c.users);
r.patch('/:id', validate(idParam, 'params'), validate(updateUserSchema), c.updateUser);
export default r;
