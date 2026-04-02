-- CreateEnum
CREATE TYPE "ImportImageRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS');

-- CreateEnum
CREATE TYPE "ImportImageJobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ImportImageIngestionRun" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "ImportImageRunStatus" NOT NULL DEFAULT 'PENDING',
    "totalJobs" INTEGER NOT NULL DEFAULT 0,
    "completedJobs" INTEGER NOT NULL DEFAULT 0,
    "failedJobs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportImageIngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportImageIngestionJob" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "storagePath" TEXT,
    "status" "ImportImageJobStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "contentType" TEXT,
    "contentLength" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportImageIngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportImageIngestionRun_sessionId_createdAt_idx" ON "ImportImageIngestionRun"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportImageIngestionRun_status_createdAt_idx" ON "ImportImageIngestionRun"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportImageIngestionJob_runId_playerId_sourceHash_key" ON "ImportImageIngestionJob"("runId", "playerId", "sourceHash");

-- CreateIndex
CREATE INDEX "ImportImageIngestionJob_runId_status_nextAttemptAt_idx" ON "ImportImageIngestionJob"("runId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ImportImageIngestionJob_sessionId_status_nextAttemptAt_idx" ON "ImportImageIngestionJob"("sessionId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ImportImageIngestionJob_playerId_idx" ON "ImportImageIngestionJob"("playerId");

-- AddForeignKey
ALTER TABLE "ImportImageIngestionRun" ADD CONSTRAINT "ImportImageIngestionRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuctionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportImageIngestionJob" ADD CONSTRAINT "ImportImageIngestionJob_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ImportImageIngestionRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportImageIngestionJob" ADD CONSTRAINT "ImportImageIngestionJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuctionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportImageIngestionJob" ADD CONSTRAINT "ImportImageIngestionJob_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
