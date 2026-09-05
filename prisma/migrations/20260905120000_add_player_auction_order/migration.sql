-- Persist the manually curated live-auction queue independently of import order.
ALTER TABLE "Player"
ADD COLUMN "auctionOrder" INTEGER;

CREATE INDEX "Player_sessionId_auctionOrder_idx"
ON "Player"("sessionId", "auctionOrder");
