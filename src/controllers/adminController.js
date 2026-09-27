import { asyncHandler, ok } from '../utils/http.js';
import * as admin from '../services/adminService.js';

export const overview = asyncHandler(async (req, res) => ok(res, await admin.overview(req.query.seasonId)));
export const auditLogs = asyncHandler(async (req, res) => ok(res, await admin.listAuditLogs(req.query)));
export const users = asyncHandler(async (_req, res) => ok(res, await admin.listUsers()));
export const updateUser = asyncHandler(async (req, res) => ok(res, await admin.updateUser(req.user, req.params.id, req.body)));

export const passwordResetRequests = asyncHandler(async (_req, res) => ok(res, await admin.listPasswordResetRequests()));
export const approvePasswordReset = asyncHandler(async (req, res) => ok(res, await admin.approvePasswordReset(req.user, req.params.id)));
export const rejectPasswordReset = asyncHandler(async (req, res) => ok(res, await admin.rejectPasswordReset(req.user, req.params.id)));
