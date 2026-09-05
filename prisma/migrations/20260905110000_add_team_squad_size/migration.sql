-- Store the maximum total squad size per team.
ALTER TABLE "Team"
ADD COLUMN "squadSize" INTEGER NOT NULL DEFAULT 16;