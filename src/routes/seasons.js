import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { createSeasonSchema, seasonStatusSchema, updateSeasonSchema } from '../validators/season.js';
import * as c from '../controllers/seasonController.js';

const r = Router();
r.get('/', c.list);
r.get('/:id', validate(idParam, 'params'), c.get);
r.post('/', authenticate, requireAdmin, validate(createSeasonSchema), c.create);
r.patch('/:id', authenticate, requireAdmin, validate(idParam, 'params'), validate(updateSeasonSchema), c.update);
r.post('/:id/status', authenticate, requireAdmin, validate(idParam, 'params'), validate(seasonStatusSchema), c.setStatus);
export default r;
