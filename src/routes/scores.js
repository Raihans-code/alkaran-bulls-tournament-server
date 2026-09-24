import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ballSchema, inningsSchema, statsSchema } from '../validators/match.js';
import * as c from '../controllers/scoreController.js';

const params = z.object({ matchId: z.string().uuid(), n: z.string().regex(/^[12]$/).optional() });

const r = Router();
r.get('/:matchId', validate(params, 'params'), c.get);
// Write routes check admin OR user.canScore inside the service (admin can grant scoring permission).
r.put('/:matchId/innings/:n', authenticate, validate(params, 'params'), validate(inningsSchema), c.updateInnings);
r.post('/:matchId/innings/:n/ball', authenticate, validate(params, 'params'), validate(ballSchema), c.addBall);
r.put('/:matchId/stats', authenticate, validate(params, 'params'), validate(statsSchema), c.saveStats);
export default r;
