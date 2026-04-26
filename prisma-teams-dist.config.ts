import { config } from "dotenv";
// Load .env.local (Next.js convention) before Prisma reads env vars
config({ path: ".env.local" });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/teams-dist/schema.prisma",
  migrations: {
    path: "prisma/teams-dist/migrations",
  },
  // For migrations, use DIRECT_URL (bypasses PgBouncer which blocks DDL statements).
  datasource: {
    url: env("TEAMS_DIST_DIRECT_URL"),
  },
});
