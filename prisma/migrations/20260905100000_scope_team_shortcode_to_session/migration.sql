-- Drop the global team short-code constraint so tournaments can reuse team codes.
DROP INDEX "Team_shortCode_key";

-- Keep short codes unique within each tournament auction session.
CREATE UNIQUE INDEX "Team_sessionId_shortCode_key" ON "Team"("sessionId", "shortCode");