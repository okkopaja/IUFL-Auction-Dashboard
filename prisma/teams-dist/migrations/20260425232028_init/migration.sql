-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('SETUP', 'TEAMS_READY', 'DRAW_IN_PROGRESS', 'DRAW_COMPLETE');

-- CreateEnum
CREATE TYPE "DrawMode" AS ENUM ('SINGLE', 'BATCH');

-- CreateEnum
CREATE TYPE "DrawActionType" AS ENUM ('SINGLE', 'BATCH', 'UNDO');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formatType" TEXT NOT NULL DEFAULT 'groups_16',
    "totalTeams" INTEGER NOT NULL DEFAULT 16,
    "status" "TournamentStatus" NOT NULL DEFAULT 'SETUP',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TdTeam" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "country" TEXT,
    "crestUrl" TEXT,
    "seedPot" INTEGER,
    "importedOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TdTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TdGroupAssignment" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "drawMode" "DrawMode" NOT NULL,
    "actionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TdGroupAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TdDrawAction" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "actionType" "DrawActionType" NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "reversible" BOOLEAN NOT NULL DEFAULT true,
    "reverted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "TdDrawAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TdTeam_tournamentId_idx" ON "TdTeam"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TdTeam_tournamentId_name_key" ON "TdTeam"("tournamentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TdGroupAssignment_teamId_key" ON "TdGroupAssignment"("teamId");

-- CreateIndex
CREATE INDEX "TdGroupAssignment_tournamentId_groupName_idx" ON "TdGroupAssignment"("tournamentId", "groupName");

-- CreateIndex
CREATE INDEX "TdGroupAssignment_actionId_idx" ON "TdGroupAssignment"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "TdGroupAssignment_tournamentId_groupName_slotIndex_key" ON "TdGroupAssignment"("tournamentId", "groupName", "slotIndex");

-- CreateIndex
CREATE INDEX "TdDrawAction_tournamentId_createdAt_idx" ON "TdDrawAction"("tournamentId", "createdAt");

-- AddForeignKey
ALTER TABLE "TdTeam" ADD CONSTRAINT "TdTeam_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdGroupAssignment" ADD CONSTRAINT "TdGroupAssignment_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdGroupAssignment" ADD CONSTRAINT "TdGroupAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TdTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdGroupAssignment" ADD CONSTRAINT "TdGroupAssignment_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "TdDrawAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdDrawAction" ADD CONSTRAINT "TdDrawAction_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
