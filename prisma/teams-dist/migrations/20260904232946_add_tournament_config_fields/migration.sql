-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "numberOfGroups" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "teamsPerGroup" INTEGER NOT NULL DEFAULT 4;
