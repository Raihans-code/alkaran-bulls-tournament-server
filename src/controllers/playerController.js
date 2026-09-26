import { asyncHandler, ok } from '../utils/http.js';
import * as players from '../services/playerService.js';

export const list = asyncHandler(async (req, res) => ok(res, await players.listPlayers(req.query)));
export const get = asyncHandler(async (req, res) => ok(res, await players.getPlayer(req.params.id)));
export const create = asyncHandler(async (req, res) => ok(res, await players.createPlayer(req.user, req.body), 201));
export const update = asyncHandler(async (req, res) => ok(res, await players.updatePlayer(req.user, req.params.id, req.body)));
export const remove = asyncHandler(async (req, res) => { await players.deletePlayer(req.user, req.params.id); ok(res, null); });
export const importMany = asyncHandler(async (req, res) => ok(res, await players.importPlayers(req.user, req.body), 201));
export const exportCsv = asyncHandler(async (req, res) => {
  const csv = await players.exportPlayersCsv(req.query.seasonId);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="players.csv"');
  res.send('\uFEFF' + csv);
});
