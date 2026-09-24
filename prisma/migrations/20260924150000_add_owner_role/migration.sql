-- Add the team-owner role without changing existing viewer accounts.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OWNER';
