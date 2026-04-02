import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TeamRole } from "@prisma/client";
import { AUCTION_TEAM_SEEDS } from "../src/lib/auctionTeams";
import { SESSION_STRINGS } from "../src/lib/constants";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL (or DATABASE_URL) must be set for prisma seed");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const TEAM_ROLE_SEEDS: TeamRole[] = [
  TeamRole.OWNER,
  TeamRole.CO_OWNER,
  TeamRole.CAPTAIN,
  TeamRole.MARQUEE,
];

async function ensureActiveSession() {
  const existingActive = await prisma.auctionSession.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  if (existingActive) {
    return existingActive;
  }

  const existingByName = await prisma.auctionSession.findFirst({
    where: { name: SESSION_STRINGS.ACTIVE_SESSION_NAME },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (existingByName) {
    return prisma.auctionSession.update({
      where: { id: existingByName.id },
      data: {
        isActive: true,
        totalPoints: 1000,
      },
      select: { id: true, name: true },
    });
  }

  return prisma.auctionSession.create({
    data: {
      name: SESSION_STRINGS.ACTIVE_SESSION_NAME,
      isActive: true,
      totalPoints: 1000,
    },
    select: { id: true, name: true },
  });
}

async function seedTeams(sessionId: string) {
  const existingTeams = await prisma.team.findMany({
    select: { shortCode: true },
  });

  const existingShortCodes = new Set(
    existingTeams.map((team) => team.shortCode),
  );
  const insertedCount = AUCTION_TEAM_SEEDS.filter(
    (team) => !existingShortCodes.has(team.shortCode),
  ).length;

  for (const team of AUCTION_TEAM_SEEDS) {
    await prisma.team.upsert({
      where: { shortCode: team.shortCode },
      update: {
        name: team.name,
        domain: team.domain,
        pointsTotal: 1000,
      },
      create: {
        name: team.name,
        shortCode: team.shortCode,
        domain: team.domain,
        pointsTotal: 1000,
        pointsSpent: 0,
        sessionId,
      },
    });
  }

  const sessionTeams = await prisma.team.findMany({
    where: { sessionId },
    select: { id: true },
  });

  const roleProfileRows = sessionTeams.flatMap((team) =>
    TEAM_ROLE_SEEDS.map((role) => ({
      teamId: team.id,
      role,
      name: null,
      imageUrl: null,
    })),
  );

  if (roleProfileRows.length > 0) {
    await prisma.teamRoleProfile.createMany({
      data: roleProfileRows,
      skipDuplicates: true,
    });
  }

  return {
    insertedCount,
    updatedCount: AUCTION_TEAM_SEEDS.length - insertedCount,
    roleProfilesEnsured: sessionTeams.length * TEAM_ROLE_SEEDS.length,
  };
}

async function main() {
  const session = await ensureActiveSession();
  const result = await seedTeams(session.id);

  console.log("Seed completed");
  console.log(`- session: ${session.name} (${session.id})`);
  console.log(
    `- teams: ${AUCTION_TEAM_SEEDS.length} total (${result.insertedCount} inserted, ${result.updatedCount} updated)`,
  );
  console.log(`- team role profiles ensured: ${result.roleProfilesEnsured}`);
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
