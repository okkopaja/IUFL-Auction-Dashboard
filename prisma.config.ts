import { config } from "dotenv";
// Load .env.local (Next.js convention) before Prisma reads env vars
config({ path: ".env.local" });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx ./prisma/seed.ts",
  },
  // For migrations, use DIRECT_URL (Supabase Session Pooler, port 5432).
  // DATABASE_URL points to the Transaction Pooler (PgBouncer, port 6543),
  // which blocks DDL statements — so it must NOT be used for `prisma migrate dev`.
  // Note: `directUrl` was removed in Prisma v7. This `url` is the direct connection.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
