import { asyncHandler, ok } from '../utils/http.js';
import * as matches from '../services/matchService.js';

export const list = asyncHandler(async (req, res) => ok(res, await matches.listMatches(req.query)));
export const get = asyncHandler(async (req, res) => ok(res, await matches.getScoreboard(req.params.id)));
export const create = asyncHandler(async (req, res) => ok(res, await matches.createMatch(req.user, req.body), 201));
export const update = asyncHandler(async (req, res) => ok(res, await matches.updateMatch(req.user, req.params.id, req.body)));
export const remove = asyncHandler(async (req, res) => { await matches.deleteMatch(req.user, req.params.id); ok(res, null); });
export const start = asyncHandler(async (req, res) => ok(res, await matches.startMatch(req.user, req.params.id, req.body)));
export const complete = asyncHandler(async (req, res) => ok(res, await matches.completeMatch(req.user, req.params.id, req.body)));
