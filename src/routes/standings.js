import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { seasonQuery } from '../validators/common.js';
import * as c from '../controllers/standingController.js';

const r = Router();
r.use(authenticate);
r.get('/', validate(seasonQuery, 'query'), c.list);
export default r;
