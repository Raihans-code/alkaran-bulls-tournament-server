import { Router } from 'express';
import { authenticate, requireOwner } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bidSchema } from '../validators/auction.js';
import * as c from '../controllers/auctionController.js';

const r = Router();
r.use(authenticate, requireOwner);
r.post('/', validate(bidSchema), c.bid);
export default r;
