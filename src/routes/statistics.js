import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import * as c from '../controllers/statsController.js';

const r = Router();
r.use(authenticate);
r.get('/history', c.history);
r.get('/seasons/:id', validate(idParam, 'params'), c.season);
export default r;
