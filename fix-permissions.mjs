import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log("✓ Connected to database via direct URL");

  // Check current schema permissions
  const perms = await client.query(`
    SELECT grantee, privilege_type
    FROM information_schema.usage_privileges
    WHERE object_schema = 'public' AND object_type = 'SCHEMA'
    ORDER BY grantee;
  `);
  console.log("\nCurrent public schema USAGE grants:");
  if (perms.rows.length === 0) {
    console.log("  (none found — this is the problem!)");
  }
  for (const r of perms.rows) {
    console.log(`  ${r.grantee}: ${r.privilege_type}`);
  }

  // Fix: Grant USAGE on schema + table/sequence permissions
  const roles = ["anon", "authenticated", "service_role"];
  console.log("\nGranting permissions...");

  for (const role of roles) {
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role};`);
    await client.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${role};`);
    await client.query(
      `GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${role};`,
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${role};`,
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${role};`,
    );
    console.log(`  ✓ ${role}`);
  }

  // Verify
  console.log("\nVerifying access...");
  const check = await client.query(
    `SELECT count(*) as cnt FROM public."Team";`,
  );
  console.log(`  Team count: ${check.rows[0].cnt}`);

  const check2 = await client.query(
    `SELECT count(*) as cnt FROM public."Player";`,
  );
  console.log(`  Player count: ${check2.rows[0].cnt}`);

  console.log("\n✓ All permissions fixed!");
  await client.end();
}

main().catch(async (e) => {
  console.error("FATAL:", e.message);
  await client.end().catch(() => {});
  process.exit(1);
});
