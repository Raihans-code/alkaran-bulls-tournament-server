import { asyncHandler, ok } from '../utils/http.js';
import * as seasons from '../services/seasonService.js';

export const list = asyncHandler(async (_req, res) => ok(res, await seasons.listSeasons()));
export const get = asyncHandler(async (req, res) => ok(res, await seasons.getSeason(req.params.id)));
export const create = asyncHandler(async (req, res) => ok(res, await seasons.createSeason(req.user, req.body), 201));
export const update = asyncHandler(async (req, res) => ok(res, await seasons.updateSeason(req.user, req.params.id, req.body)));
export const setStatus = asyncHandler(async (req, res) => ok(res, await seasons.setStatus(req.user, req.params.id, req.body)));
