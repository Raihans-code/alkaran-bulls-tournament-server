import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bidSchema } from '../validators/auction.js';
import * as c from '../controllers/auctionController.js';

const r = Router();
// Bidding is admin-only: the auctioneer bids on behalf of a team. Team owners watch like any other viewer.
r.use(authenticate, requireAdmin);
r.post('/', validate(bidSchema), c.bid);
export default r;