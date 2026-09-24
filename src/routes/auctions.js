import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { seasonQuery } from '../validators/common.js';
import { resetPlayerSchema, seasonOnlySchema, startAuctionSchema } from '../validators/auction.js';
import * as c from '../controllers/auctionController.js';

const r = Router();
r.get('/state', validate(seasonQuery, 'query'), c.state);
r.get('/history', validate(seasonQuery.extend({ playerId: seasonQuery.shape.seasonId.optional() }), 'query'), c.history);
// Admin-only controls. Users have no route that can start, close or reset an auction.
r.post('/start', authenticate, requireAdmin, validate(startAuctionSchema), c.start);
r.post('/sold', authenticate, requireAdmin, validate(seasonOnlySchema), c.sold);
r.post('/unsold', authenticate, requireAdmin, validate(seasonOnlySchema), c.unsold);
r.post('/withdraw', authenticate, requireAdmin, validate(seasonOnlySchema), c.withdraw);
r.post('/cancel', authenticate, requireAdmin, validate(seasonOnlySchema), c.cancel);
r.post('/reset-player', authenticate, requireAdmin, validate(resetPlayerSchema), c.resetPlayer);
export default r;
