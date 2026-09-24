import { Router } from 'express';
import { authenticate, requireAdmin, requireOwner } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { purseSchema, registerTeamSchema, registrationSchema, teamListQuery, updateTeamSchema } from '../validators/team.js';
import { z } from 'zod';
import * as c from '../controllers/teamController.js';

const r = Router();
r.get('/', validate(teamListQuery, 'query'), c.list);
r.get('/mine', authenticate, validate(z.object({ seasonId: z.string().uuid().optional() }), 'query'), c.mine);
r.get('/:id', validate(idParam, 'params'), c.get);
r.post('/', authenticate, requireOwner, validate(registerTeamSchema), c.register);
r.patch('/:id', authenticate, requireOwner, validate(idParam, 'params'), validate(updateTeamSchema), c.update);
r.post('/:id/registration', authenticate, requireAdmin, validate(idParam, 'params'), validate(registrationSchema), c.setRegistration);
r.post('/:id/purse', authenticate, requireAdmin, validate(idParam, 'params'), validate(purseSchema), c.adjustPurse);
export default r;
