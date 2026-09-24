import { asyncHandler, ok } from '../utils/http.js';
import * as scores from '../services/scoreService.js';

export const get = asyncHandler(async (req, res) => ok(res, await scores.getScoreboard(req.params.matchId)));
export const updateInnings = asyncHandler(async (req, res) => ok(res, await scores.updateInnings(req.user, req.params.matchId, Number(req.params.n), req.body)));
export const addBall = asyncHandler(async (req, res) => ok(res, await scores.addBall(req.user, req.params.matchId, Number(req.params.n), req.body)));
export const saveStats = asyncHandler(async (req, res) => ok(res, await scores.saveStats(req.user, req.params.matchId, req.body.rows)));
