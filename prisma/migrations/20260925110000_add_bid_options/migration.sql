-- Add four configurable bid increments to each season.
ALTER TABLE "Season"
ADD COLUMN "bidOptions" INTEGER[] NOT NULL DEFAULT ARRAY[100, 300, 500, 1000];
