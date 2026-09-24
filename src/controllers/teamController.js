import { asyncHandler, ok } from '../utils/http.js';
import * as teams from '../services/teamService.js';

export const list = asyncHandler(async (req, res) => ok(res, await teams.listTeams(req.query)));
export const mine = asyncHandler(async (req, res) => ok(res, await teams.myTeams(req.user, req.query.seasonId)));
export const get = asyncHandler(async (req, res) => ok(res, await teams.getTeam(req.params.id)));
export const register = asyncHandler(async (req, res) => ok(res, await teams.registerTeam(req.user, req.body), 201));
export const update = asyncHandler(async (req, res) => ok(res, await teams.updateTeam(req.user, req.params.id, req.body)));
export const setRegistration = asyncHandler(async (req, res) => ok(res, await teams.setRegistration(req.user, req.params.id, req.body.status)));
export const adjustPurse = asyncHandler(async (req, res) => ok(res, await teams.adjustPurse(req.user, req.params.id, req.body)));
