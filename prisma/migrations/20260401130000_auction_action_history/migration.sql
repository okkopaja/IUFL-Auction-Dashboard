-- CreateEnum
CREATE TYPE "AuctionActionType" AS ENUM ('PASS', 'SELL');

-- CreateTable
CREATE TABLE "AuctionActionHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromPlayerId" TEXT NOT NULL,
    "toPlayerId" TEXT,
    "actionType" "AuctionActionType" NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionActionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuctionActionHistory_transactionId_key" ON "AuctionActionHistory"("transactionId");

-- CreateIndex
CREATE INDEX "AuctionActionHistory_sessionId_createdAt_idx" ON "AuctionActionHistory"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AuctionActionHistory_actionType_idx" ON "AuctionActionHistory"("actionType");

-- CreateIndex
CREATE INDEX "AuctionActionHistory_fromPlayerId_createdAt_idx" ON "AuctionActionHistory"("fromPlayerId", "createdAt");

-- CreateIndex
CREATE INDEX "AuctionActionHistory_toPlayerId_createdAt_idx" ON "AuctionActionHistory"("toPlayerId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuctionActionHistory" ADD CONSTRAINT "AuctionActionHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuctionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionActionHistory" ADD CONSTRAINT "AuctionActionHistory_fromPlayerId_fkey" FOREIGN KEY ("fromPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionActionHistory" ADD CONSTRAINT "AuctionActionHistory_toPlayerId_fkey" FOREIGN KEY ("toPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionActionHistory" ADD CONSTRAINT "AuctionActionHistory_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
