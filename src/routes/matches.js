import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { completeMatchSchema, createMatchSchema, matchListQuery, startMatchSchema, updateMatchSchema } from '../validators/match.js';
import * as c from '../controllers/matchController.js';

const r = Router();
r.get('/', validate(matchListQuery, 'query'), c.list);
r.get('/:id', validate(idParam, 'params'), c.get);
r.post('/', authenticate, requireAdmin, validate(createMatchSchema), c.create);
r.patch('/:id', authenticate, requireAdmin, validate(idParam, 'params'), validate(updateMatchSchema), c.update);
r.delete('/:id', authenticate, requireAdmin, validate(idParam, 'params'), c.remove);
r.post('/:id/start', authenticate, requireAdmin, validate(idParam, 'params'), validate(startMatchSchema), c.start);
r.post('/:id/complete', authenticate, requireAdmin, validate(idParam, 'params'), validate(completeMatchSchema), c.complete);
export default r;
