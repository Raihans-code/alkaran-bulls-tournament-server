import { asyncHandler, ok } from '../utils/http.js';
import * as auction from '../services/auctionService.js';

export const state = asyncHandler(async (req, res) => ok(res, await auction.getAuctionState(req.query.seasonId)));
export const history = asyncHandler(async (req, res) => ok(res, await auction.auctionHistory(req.query)));
export const start = asyncHandler(async (req, res) => ok(res, await auction.startAuction(req.user, req.body)));
export const sold = asyncHandler(async (req, res) => ok(res, await auction.markSold(req.user, req.body)));
export const unsold = asyncHandler(async (req, res) => ok(res, await auction.markUnsold(req.user, req.body)));
export const withdraw = asyncHandler(async (req, res) => ok(res, await auction.withdrawPlayer(req.user, req.body)));
export const cancel = asyncHandler(async (req, res) => ok(res, await auction.cancelAuction(req.user, req.body)));
export const resetPlayer = asyncHandler(async (req, res) => ok(res, await auction.resetPlayer(req.user, req.body)));
// REST fallback for bidding; the primary path is the Socket.IO `auction:bid` event.
export const bid = asyncHandler(async (req, res) => ok(res, await auction.placeBid(req.user, req.body), 201));
