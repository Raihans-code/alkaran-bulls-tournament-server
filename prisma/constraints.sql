-- Database-level safety nets that Prisma's schema language cannot express.
-- Run once after the first migration:  npm run db:constraints  (safe to re-run)
-- The application already enforces all of these in a transaction; this is defence in depth.

-- 1. A purse can never go negative.
DO $$ BEGIN
  ALTER TABLE "Team" ADD CONSTRAINT team_purse_non_negative CHECK (purse >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Only one LIVE auction per season.
CREATE UNIQUE INDEX IF NOT EXISTS one_live_auction_per_season ON "Auction" ("seasonId") WHERE status = 'LIVE';

-- 3. A squad can never exceed the season's maxPlayersPerTeam (default 8).
CREATE OR REPLACE FUNCTION enforce_squad_limit() RETURNS trigger AS $$
DECLARE
  max_players integer;
  current_count integer;
BEGIN
  SELECT "maxPlayersPerTeam" INTO max_players FROM "Season" WHERE id = NEW."seasonId";
  SELECT count(*) INTO current_count FROM "SquadPlayer" WHERE "teamId" = NEW."teamId";
  IF current_count >= max_players THEN
    RAISE EXCEPTION 'SQUAD_FULL: team already has % players', current_count USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS squad_limit ON "SquadPlayer";
CREATE TRIGGER squad_limit BEFORE INSERT ON "SquadPlayer" FOR EACH ROW EXECUTE FUNCTION enforce_squad_limit();

-- 4. A team cannot play itself.
DO $$ BEGIN
  ALTER TABLE "Match" ADD CONSTRAINT match_distinct_teams CHECK ("teamAId" <> "teamBId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
