-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "auctionSessionId" TEXT;

-- Index for resolving the selected tournament's auction session.
CREATE INDEX "Tournament_auctionSessionId_idx" ON "Tournament"("auctionSessionId");