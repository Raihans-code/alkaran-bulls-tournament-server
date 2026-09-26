import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam, seasonQuery } from '../validators/common.js';
import { assignPlayerSchema, createPlayerSchema, importPlayersSchema, playerListQuery, updatePlayerSchema } from '../validators/player.js';
import * as c from '../controllers/playerController.js';

const r = Router();
r.use(authenticate);
r.get('/', validate(playerListQuery, 'query'), c.list);
r.get('/export', requireAdmin, validate(seasonQuery, 'query'), c.exportCsv);
r.get('/:id', validate(idParam, 'params'), c.get);
r.post('/', requireAdmin, validate(createPlayerSchema), c.create);
r.post('/import', requireAdmin, validate(importPlayersSchema), c.importMany);
r.post('/:id/assign', requireAdmin, validate(idParam, 'params'), validate(assignPlayerSchema), c.assignToTeam);
r.post('/:id/remove-from-team', requireAdmin, validate(idParam, 'params'), c.removeFromTeam);
r.patch('/:id', requireAdmin, validate(idParam, 'params'), validate(updatePlayerSchema), c.update);
r.delete('/:id', requireAdmin, validate(idParam, 'params'), c.remove);
export default r;
