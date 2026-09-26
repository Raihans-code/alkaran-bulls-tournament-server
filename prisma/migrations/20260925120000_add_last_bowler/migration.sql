ALTER TABLE "MatchScore" ADD COLUMN IF NOT EXISTS "lastBowlerId" TEXT;

-- Existing innings at a completed over must select a new active bowler.
UPDATE "MatchScore"
SET "lastBowlerId" = "bowlerId", "bowlerId" = NULL
WHERE "balls" > 0 AND MOD("balls", 6) = 0 AND "status" <> 'COMPLETED' AND "bowlerId" IS NOT NULL;
