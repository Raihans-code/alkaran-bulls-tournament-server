import { asyncHandler, ok } from '../utils/http.js';
import * as stats from '../services/statsService.js';

export const season = asyncHandler(async (req, res) => ok(res, await stats.seasonStats(req.params.id)));
export const history = asyncHandler(async (_req, res) => ok(res, await stats.history()));
