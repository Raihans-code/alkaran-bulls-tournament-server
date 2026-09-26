BEGIN;

-- Create the new enum type with A..Z plus NO_CATEGORY
CREATE TYPE public."PlayerCategory_new" AS ENUM (
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','NO_CATEGORY'
);

-- Convert existing Player.category values to the new enum using a mapping
-- Drop default first so the column can be altered
ALTER TABLE public."Player" ALTER COLUMN "category" DROP DEFAULT;

ALTER TABLE public."Player" ALTER COLUMN "category" TYPE public."PlayerCategory_new" USING (
  (CASE "category"
    WHEN 'ICON' THEN 'A'
    WHEN 'BATSMAN' THEN 'B'
    WHEN 'BOWLER' THEN 'C'
    WHEN 'ALL_ROUNDER' THEN 'D'
    WHEN 'WICKET_KEEPER' THEN 'E'
    WHEN 'GENERAL' THEN 'NO_CATEGORY'
    ELSE 'NO_CATEGORY'
  END)::public."PlayerCategory_new"
);

-- Set a sensible default for new rows
ALTER TABLE public."Player" ALTER COLUMN "category" SET DEFAULT 'NO_CATEGORY';

-- Replace the old enum type with the new one
DROP TYPE public."PlayerCategory";
ALTER TYPE public."PlayerCategory_new" RENAME TO "PlayerCategory";

COMMIT;
