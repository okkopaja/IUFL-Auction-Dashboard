-- CreateEnum
CREATE TYPE "AuctionEndReason" AS ENUM ('UNSOLD_DEPLETED', 'ITERATION_LIMIT_REACHED');

-- AlterTable
ALTER TABLE "AuctionSession"
ADD COLUMN "auctionEndReason" "AuctionEndReason",
ADD COLUMN "endedAt" TIMESTAMP(3),
ADD COLUMN "isAuctionEnded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "restartAckRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "unsoldIterationAnchorPlayerId" TEXT,
ADD COLUMN "unsoldIterationRound" INTEGER NOT NULL DEFAULT 1;
