/**
 * Prisma client singleton for the teams-dist database.
 *
 * This is a separate Supabase project from the main auction DB.
 * The generated client lives at node_modules/.prisma/teams-dist-client
 * (controlled by the `output` field in prisma/teams-dist/schema.prisma).
 *
 * Prisma 7 removed `datasourceUrl` from the PrismaClient constructor.
 * Connection must be provided via a driver adapter (@prisma/adapter-pg).
 *
 * Import in server code only:
 *   import { tdPrisma } from "@/lib/teams-dist/prisma"
 */

import { PrismaPg } from "@prisma/adapter-pg";

// Use require() to avoid tsc complaining about a non-standard paths.
// The module exists at runtime because `npm run td:generate` creates it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("../../../node_modules/.prisma/teams-dist-client");

// Narrow the global to our client type
const globalForPrisma = globalThis as typeof globalThis & {
  tdPrisma?: typeof PrismaClient.prototype;
};

function createTdPrismaClient() {
  const connectionString = process.env.TEAMS_DIST_DATABASE_URL;
  if (!connectionString) {
    throw new Error("TEAMS_DIST_DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const tdPrisma: typeof PrismaClient.prototype =
  globalForPrisma.tdPrisma ?? createTdPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.tdPrisma = tdPrisma;
}
