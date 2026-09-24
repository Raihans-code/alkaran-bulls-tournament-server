-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('UPCOMING', 'REGISTRATION', 'AUCTION', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PlayerCategory" AS ENUM ('ICON', 'BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER', 'GENERAL');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('AVAILABLE', 'IN_AUCTION', 'SOLD', 'UNSOLD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('LIVE', 'SOLD', 'UNSOLD', 'WITHDRAWN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('UPCOMING', 'LIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ResultType" AS ENUM ('WIN', 'TIE', 'NO_RESULT');

-- CreateEnum
CREATE TYPE "InningsStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canScore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "status" "SeasonStatus" NOT NULL DEFAULT 'UPCOMING',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "maxTeams" INTEGER NOT NULL DEFAULT 10,
    "maxPlayersPerTeam" INTEGER NOT NULL DEFAULT 8,
    "initialTeamBudget" INTEGER NOT NULL DEFAULT 10000,
    "bidIncrement" INTEGER NOT NULL DEFAULT 100,
    "allowMultipleTeamsPerUser" BOOLEAN NOT NULL DEFAULT false,
    "winPoints" INTEGER NOT NULL DEFAULT 2,
    "tiePoints" INTEGER NOT NULL DEFAULT 1,
    "noResultPoints" INTEGER NOT NULL DEFAULT 1,
    "lossPoints" INTEGER NOT NULL DEFAULT 0,
    "championTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "contactInfo" TEXT,
    "ownerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "purse" INTEGER NOT NULL,
    "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "phone" TEXT,
    "category" "PlayerCategory" NOT NULL DEFAULT 'GENERAL',
    "basePrice" INTEGER NOT NULL,
    "status" "PlayerStatus" NOT NULL DEFAULT 'AVAILABLE',
    "seasonId" TEXT NOT NULL,
    "currentTeamId" TEXT,
    "soldPrice" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'LIVE',
    "basePrice" INTEGER NOT NULL,
    "currentBid" INTEGER NOT NULL,
    "highestBidTeamId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionBid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadPlayer" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "venue" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "oversLimit" INTEGER NOT NULL DEFAULT 10,
    "status" "MatchStatus" NOT NULL DEFAULT 'UPCOMING',
    "resultType" "ResultType",
    "winnerId" TEXT,
    "resultText" TEXT,
    "playerOfMatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchScore" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "inningsNumber" INTEGER NOT NULL,
    "battingTeamId" TEXT NOT NULL,
    "bowlingTeamId" TEXT NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "balls" INTEGER NOT NULL DEFAULT 0,
    "extras" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER,
    "strikerId" TEXT,
    "nonStrikerId" TEXT,
    "bowlerId" TEXT,
    "status" "InningsStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayerStatistic" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "ballsFaced" INTEGER NOT NULL DEFAULT 0,
    "fours" INTEGER NOT NULL DEFAULT 0,
    "sixes" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "ballsBowled" INTEGER NOT NULL DEFAULT 0,
    "runsConceded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MatchPlayerStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamStanding" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "won" INTEGER NOT NULL DEFAULT 0,
    "lost" INTEGER NOT NULL DEFAULT 0,
    "tied" INTEGER NOT NULL DEFAULT 0,
    "noResult" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "runsFor" INTEGER NOT NULL DEFAULT 0,
    "ballsFaced" INTEGER NOT NULL DEFAULT 0,
    "runsAgainst" INTEGER NOT NULL DEFAULT 0,
    "ballsBowled" INTEGER NOT NULL DEFAULT 0,
    "netRunRate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "TeamStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "seasonId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Season_seasonNumber_key" ON "Season"("seasonNumber");

-- CreateIndex
CREATE INDEX "Team_seasonId_registrationStatus_idx" ON "Team"("seasonId", "registrationStatus");

-- CreateIndex
CREATE INDEX "Team_ownerId_idx" ON "Team"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_seasonId_name_key" ON "Team"("seasonId", "name");

-- CreateIndex
CREATE INDEX "Player_seasonId_status_idx" ON "Player"("seasonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Player_seasonId_name_key" ON "Player"("seasonId", "name");

-- CreateIndex
CREATE INDEX "Auction_seasonId_status_idx" ON "Auction"("seasonId", "status");

-- CreateIndex
CREATE INDEX "Auction_playerId_idx" ON "Auction"("playerId");

-- CreateIndex
CREATE INDEX "AuctionBid_auctionId_createdAt_idx" ON "AuctionBid"("auctionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SquadPlayer_playerId_key" ON "SquadPlayer"("playerId");

-- CreateIndex
CREATE INDEX "SquadPlayer_teamId_idx" ON "SquadPlayer"("teamId");

-- CreateIndex
CREATE INDEX "SquadPlayer_seasonId_idx" ON "SquadPlayer"("seasonId");

-- CreateIndex
CREATE INDEX "Match_seasonId_status_idx" ON "Match"("seasonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Match_seasonId_matchNumber_key" ON "Match"("seasonId", "matchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MatchScore_matchId_inningsNumber_key" ON "MatchScore"("matchId", "inningsNumber");

-- CreateIndex
CREATE INDEX "MatchPlayerStatistic_playerId_idx" ON "MatchPlayerStatistic"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayerStatistic_matchId_playerId_key" ON "MatchPlayerStatistic"("matchId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamStanding_teamId_key" ON "TeamStanding"("teamId");

-- CreateIndex
CREATE INDEX "TeamStanding_seasonId_points_idx" ON "TeamStanding"("seasonId", "points");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_seasonId_idx" ON "AuditLog"("seasonId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_currentTeamId_fkey" FOREIGN KEY ("currentTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_highestBidTeamId_fkey" FOREIGN KEY ("highestBidTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadPlayer" ADD CONSTRAINT "SquadPlayer_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadPlayer" ADD CONSTRAINT "SquadPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadPlayer" ADD CONSTRAINT "SquadPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScore" ADD CONSTRAINT "MatchScore_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStatistic" ADD CONSTRAINT "MatchPlayerStatistic_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStatistic" ADD CONSTRAINT "MatchPlayerStatistic_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStanding" ADD CONSTRAINT "TeamStanding_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStanding" ADD CONSTRAINT "TeamStanding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
