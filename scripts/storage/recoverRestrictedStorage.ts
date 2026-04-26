import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import {
  chunkItems,
  formatBytes,
  getDefaultBuckets,
  parseStorageRefFromPublicUrl,
} from "./common";

type ReferenceSource = "player" | "team-role" | "ingestion-job";

interface StorageRow {
  id: string;
  bucket_id: string;
  name: string;
  size_bytes: string | number | null;
}

interface StorageReference {
  source: ReferenceSource;
  entityId: string;
  bucketId: string;
  path: string;
}

interface DeletionCandidate {
  id: string;
  bucketId: string;
  path: string;
  sizeBytes: number;
  isLikelyTest: boolean;
}

interface CliOptions {
  apply: boolean;
  buckets: string[];
  limit: number | null;
  onlyLikelyTest: boolean;
}

function timestampForFile(date = new Date()): string {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const sec = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${sec}`;
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function parseCliOptions(argv: string[]): CliOptions {
  const apply = argv.includes("--apply");
  const onlyLikelyTest = argv.includes("--only-likely-test");

  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const limit = parsePositiveInt(limitArg?.split("=")[1]);

  const bucketsArg = argv.find((arg) => arg.startsWith("--buckets="));
  const buckets = bucketsArg
    ? (bucketsArg
        .split("=")[1]
        ?.split(",")
        .map((entry) => entry.trim())
        .filter(Boolean) ?? getDefaultBuckets())
    : getDefaultBuckets();

  return {
    apply,
    buckets,
    limit,
    onlyLikelyTest,
  };
}

function normalizePath(rawPath: string): string {
  return rawPath.replace(/^\/+/, "").trim();
}

function isLikelyTestPath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    /(^|\/)(test|tests|tmp|temp|debug|draft|sample)(\/|$)/.test(lower) ||
    lower.includes("mock")
  );
}

function toSizeBytes(value: string | number | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function buildReferenceKey(bucketId: string, path: string): string {
  return `${bucketId}/${path}`;
}

async function createPgClient(): Promise<Client> {
  const connectionString = process.env.DIRECT_URL?.trim();
  if (!connectionString) {
    throw new Error("DIRECT_URL is required for restricted cleanup mode");
  }

  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

async function fetchStorageRows(
  client: Client,
  buckets: string[],
): Promise<StorageRow[]> {
  const sql = `
    select
      id,
      bucket_id,
      name,
      coalesce((metadata->>'size')::bigint, 0) as size_bytes
    from storage.objects
    where bucket_id = any($1::text[])
    order by name asc
  `;

  const res = await client.query<StorageRow>(sql, [buckets]);
  return res.rows;
}

async function fetchReferences(
  client: Client,
  playerBucket: string,
): Promise<StorageReference[]> {
  const references: StorageReference[] = [];

  const playersRes = await client.query<{
    id: string;
    imageUrl: string | null;
  }>('select "id", "imageUrl" from "Player" where "imageUrl" is not null');

  for (const row of playersRes.rows) {
    const parsed = parseStorageRefFromPublicUrl(row.imageUrl);
    if (!parsed) continue;

    references.push({
      source: "player",
      entityId: row.id,
      bucketId: parsed.bucketId,
      path: parsed.path,
    });
  }

  const teamRolesRes = await client.query<{
    id: string;
    imageUrl: string | null;
  }>(
    'select "id", "imageUrl" from "TeamRoleProfile" where "imageUrl" is not null',
  );

  for (const row of teamRolesRes.rows) {
    const parsed = parseStorageRefFromPublicUrl(row.imageUrl);
    if (!parsed) continue;

    references.push({
      source: "team-role",
      entityId: row.id,
      bucketId: parsed.bucketId,
      path: parsed.path,
    });
  }

  const ingestionRes = await client.query<{
    id: string;
    storagePath: string | null;
  }>(
    'select "id", "storagePath" from "ImportImageIngestionJob" where "storagePath" is not null',
  );

  for (const row of ingestionRes.rows) {
    if (!row.storagePath) continue;

    references.push({
      source: "ingestion-job",
      entityId: row.id,
      bucketId: playerBucket,
      path: normalizePath(row.storagePath),
    });
  }

  return references;
}

function selectDeletionCandidates(
  rows: StorageRow[],
  references: StorageReference[],
  options: CliOptions,
): DeletionCandidate[] {
  const referenceSet = new Set(
    references.map((reference) =>
      buildReferenceKey(reference.bucketId, reference.path),
    ),
  );

  let candidates = rows
    .map<DeletionCandidate>((row) => ({
      id: row.id,
      bucketId: row.bucket_id,
      path: normalizePath(row.name),
      sizeBytes: toSizeBytes(row.size_bytes),
      isLikelyTest: isLikelyTestPath(normalizePath(row.name)),
    }))
    .filter(
      (row) => !referenceSet.has(buildReferenceKey(row.bucketId, row.path)),
    )
    .sort((a, b) => b.sizeBytes - a.sizeBytes);

  if (options.onlyLikelyTest) {
    candidates = candidates.filter((candidate) => candidate.isLikelyTest);
  }

  if (options.limit && candidates.length > options.limit) {
    candidates = candidates.slice(0, options.limit);
  }

  return candidates;
}

async function applyDeletion(
  client: Client,
  candidates: DeletionCandidate[],
): Promise<{
  deleted: DeletionCandidate[];
  failed: Array<{ id: string; reason: string }>;
}> {
  const deleted: DeletionCandidate[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  const chunks = chunkItems(candidates, 200);

  for (const chunk of chunks) {
    const ids = chunk.map((candidate) => candidate.id);

    try {
      await client.query("begin");
      await client.query("set local storage.allow_delete_query = 'true'");

      const deleteSql = `
        delete from storage.objects
        where id = any($1::uuid[])
        returning id
      `;

      const deletedRowsRes = await client.query<{ id: string }>(deleteSql, [
        ids,
      ]);
      await client.query("commit");

      const deletedIds = new Set(deletedRowsRes.rows.map((row) => row.id));
      for (const candidate of chunk) {
        if (deletedIds.has(candidate.id)) {
          deleted.push(candidate);
        } else {
          failed.push({
            id: candidate.id,
            reason: "not deleted (no returned row)",
          });
        }
      }
    } catch (error) {
      await client.query("rollback");
      const reason = error instanceof Error ? error.message : "unknown";
      for (const candidate of chunk) {
        failed.push({
          id: candidate.id,
          reason,
        });
      }
    }
  }

  return { deleted, failed };
}

async function writeManifest(payload: unknown): Promise<string> {
  await mkdir(join("docs", "reports"), { recursive: true });
  const reportPath = join(
    "docs",
    "reports",
    `storage-restricted-cleanup-${timestampForFile()}.json`,
  );

  await writeFile(reportPath, JSON.stringify(payload, null, 2), "utf8");
  return reportPath;
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const playerBucket =
    process.env.PLAYER_IMAGES_BUCKET?.trim() || "player-images";

  const client = await createPgClient();

  try {
    const [rows, references] = await Promise.all([
      fetchStorageRows(client, options.buckets),
      fetchReferences(client, playerBucket),
    ]);

    const candidates = selectDeletionCandidates(rows, references, options);
    const candidateBytes = candidates.reduce(
      (total, candidate) => total + candidate.sizeBytes,
      0,
    );

    console.log("Restricted cleanup candidate summary");
    console.log(`Buckets: ${options.buckets.join(", ")}`);
    console.log(`Objects scanned: ${rows.length}`);
    console.log(`Reference rows: ${references.length}`);
    console.log(`Selected candidates: ${candidates.length}`);
    console.log(
      `Selected bytes: ${formatBytes(candidateBytes)} (${candidateBytes})`,
    );
    console.log(`Mode: ${options.apply ? "apply" : "dry-run"}`);

    if (candidates.length > 0) {
      console.log("Top candidates:");
      for (const entry of candidates.slice(0, 20)) {
        console.log(
          `- ${entry.bucketId}/${entry.path} (${formatBytes(entry.sizeBytes)})`,
        );
      }
    }

    if (!options.apply) {
      const reportPath = await writeManifest({
        generatedAt: new Date().toISOString(),
        mode: "dry-run",
        options,
        scannedObjects: rows.length,
        referenceRows: references.length,
        candidateCount: candidates.length,
        candidateBytes,
        candidates,
      });

      console.log(`Report: ${reportPath}`);
      return;
    }

    if (candidates.length === 0) {
      console.log("No candidates selected. Nothing to delete.");
      return;
    }

    const outcome = await applyDeletion(client, candidates);

    const deletedBytes = outcome.deleted.reduce(
      (total, candidate) => total + candidate.sizeBytes,
      0,
    );

    const reportPath = await writeManifest({
      generatedAt: new Date().toISOString(),
      mode: "apply",
      options,
      scannedObjects: rows.length,
      referenceRows: references.length,
      candidateCount: candidates.length,
      candidateBytes,
      deletedCount: outcome.deleted.length,
      deletedBytes,
      failedCount: outcome.failed.length,
      deleted: outcome.deleted,
      failed: outcome.failed,
    });

    console.log("Restricted cleanup apply completed");
    console.log(`Deleted objects: ${outcome.deleted.length}`);
    console.log(
      `Deleted bytes: ${formatBytes(deletedBytes)} (${deletedBytes})`,
    );
    console.log(`Failed objects: ${outcome.failed.length}`);
    console.log(`Report: ${reportPath}`);

    if (outcome.failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error("Restricted cleanup failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
