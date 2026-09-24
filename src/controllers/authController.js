import { asyncHandler, ok } from '../utils/http.js';
import * as auth from '../services/authService.js';

export const register = asyncHandler(async (req, res) => ok(res, await auth.register(req.body), 201));
export const login = asyncHandler(async (req, res) => ok(res, await auth.login(req.body)));
export const me = asyncHandler(async (req, res) => ok(res, { user: auth.publicUser(req.user) }));
