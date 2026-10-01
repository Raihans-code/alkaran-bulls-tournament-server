import { Router } from 'express';
import { authenticate, requireOwner } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bidSchema } from '../validators/auction.js';
import * as c from '../controllers/auctionController.js';

const r = Router();
// Owners place their own bids; admins can still bid for any approved team.
r.use(authenticate, requireOwner);
r.post('/', validate(bidSchema), c.bid);
export default r;