import { asyncHandler, ok } from '../utils/http.js';
import { getStandings } from '../services/standingService.js';

export const list = asyncHandler(async (req, res) => ok(res, await getStandings(req.query.seasonId)));
