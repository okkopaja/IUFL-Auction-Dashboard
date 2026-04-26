-- AlterEnum
ALTER TYPE "DrawActionType" ADD VALUE 'RESET';

-- CreateTable
CREATE TABLE "TdWatchdogStage" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "drawMode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TdWatchdogStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TdWatchdogSpinState" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "isSpinning" BOOLEAN NOT NULL DEFAULT false,
    "drawMode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TdWatchdogSpinState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TdWatchdogStage_tournamentId_idx" ON "TdWatchdogStage"("tournamentId");

-- CreateIndex
CREATE INDEX "TdWatchdogStage_tournamentId_drawMode_idx" ON "TdWatchdogStage"("tournamentId", "drawMode");

-- CreateIndex
CREATE UNIQUE INDEX "TdWatchdogSpinState_tournamentId_key" ON "TdWatchdogSpinState"("tournamentId");

-- AddForeignKey
ALTER TABLE "TdWatchdogStage" ADD CONSTRAINT "TdWatchdogStage_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdWatchdogStage" ADD CONSTRAINT "TdWatchdogStage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TdTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdWatchdogSpinState" ADD CONSTRAINT "TdWatchdogSpinState_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
