-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'CO_OWNER', 'CAPTAIN', 'MARQUEE');

-- CreateTable
CREATE TABLE "TeamRoleProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamRoleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamRoleProfile_teamId_role_key" ON "TeamRoleProfile"("teamId", "role");

-- CreateIndex
CREATE INDEX "TeamRoleProfile_teamId_idx" ON "TeamRoleProfile"("teamId");

-- AddForeignKey
ALTER TABLE "TeamRoleProfile" ADD CONSTRAINT "TeamRoleProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
