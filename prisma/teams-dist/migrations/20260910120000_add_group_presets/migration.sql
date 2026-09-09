CREATE TABLE "TdGroupPreset" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TdGroupPreset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TdGroupPreset_teamId_key" ON "TdGroupPreset"("teamId");
CREATE UNIQUE INDEX "TdGroupPreset_tournamentId_teamId_key" ON "TdGroupPreset"("tournamentId", "teamId");
CREATE INDEX "TdGroupPreset_tournamentId_groupName_idx" ON "TdGroupPreset"("tournamentId", "groupName");

ALTER TABLE "TdGroupPreset"
ADD CONSTRAINT "TdGroupPreset_tournamentId_fkey"
FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TdGroupPreset"
ADD CONSTRAINT "TdGroupPreset_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "TdTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;