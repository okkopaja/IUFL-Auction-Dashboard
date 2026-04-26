import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildStorageSnapshot,
  chunkItems,
  createSupabaseAdminClient,
  formatBytes,
  getDefaultBuckets,
  type StorageObjectEntry,
} from "./common";

type CliOptions = {
  apply: boolean;
  limit: number | null;
  onlyLikelyTest: boolean;
  buckets: string[];
};

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
    limit,
    onlyLikelyTest,
    buckets,
  };
}

function selectCandidates(
  objects: StorageObjectEntry[],
  options: Pick<CliOptions, "limit" | "onlyLikelyTest">,
): StorageObjectEntry[] {
  let selected = objects.filter((entry) => entry.isOrphan);

  if (options.onlyLikelyTest) {
    selected = selected.filter((entry) => entry.isLikelyTest);
  }

  selected = selected.sort((a, b) => b.sizeBytes - a.sizeBytes);

  if (options.limit && selected.length > options.limit) {
    return selected.slice(0, options.limit);
  }

  return selected;
}

async function runApplyMode(candidates: StorageObjectEntry[]) {
  const supabase = createSupabaseAdminClient();
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalCandidates: candidates.length,
    requestedDeleteBytes: candidates.reduce(
      (total, entry) => total + entry.sizeBytes,
      0,
    ),
    deleted: [] as Array<{
      bucketId: string;
      path: string;
      sizeBytes: number;
    }>,
    failed: [] as Array<{
      bucketId: string;
      path: string;
      sizeBytes: number;
      reason: string;
    }>,
  };

  const byBucket = new Map<string, StorageObjectEntry[]>();
  for (const candidate of candidates) {
    const list = byBucket.get(candidate.bucketId);
    if (list) {
      list.push(candidate);
    } else {
      byBucket.set(candidate.bucketId, [candidate]);
    }
  }

  for (const [bucketId, entries] of byBucket) {
    const pathChunks = chunkItems(entries, 100);

    for (const chunk of pathChunks) {
      const paths = chunk.map((entry) => entry.path);
      const { error } = await supabase.storage.from(bucketId).remove(paths);

      if (error) {
        for (const entry of chunk) {
          manifest.failed.push({
            bucketId,
            path: entry.path,
            sizeBytes: entry.sizeBytes,
            reason: error.message,
          });
        }
        continue;
      }

      for (const entry of chunk) {
        manifest.deleted.push({
          bucketId,
          path: entry.path,
          sizeBytes: entry.sizeBytes,
        });
      }
    }
  }

  await mkdir(join("docs", "reports"), { recursive: true });
  const manifestPath = join(
    "docs",
    "reports",
    `storage-delete-manifest-${timestampForFile()}.json`,
  );
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  const deletedBytes = manifest.deleted.reduce(
    (total, entry) => total + entry.sizeBytes,
    0,
  );

  console.log("Cleanup apply completed");
  console.log(`Deleted objects: ${manifest.deleted.length}`);
  console.log(`Deleted bytes: ${deletedBytes} (${formatBytes(deletedBytes)})`);
  console.log(`Failed objects: ${manifest.failed.length}`);
  console.log(`Manifest: ${manifestPath}`);
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const snapshot = await buildStorageSnapshot(options.buckets);
  const candidates = selectCandidates(snapshot.objects, options);

  const candidateBytes = candidates.reduce(
    (total, entry) => total + entry.sizeBytes,
    0,
  );

  console.log("Storage cleanup candidate summary");
  console.log(`Buckets: ${snapshot.buckets.join(", ")}`);
  console.log(`Orphan objects total: ${snapshot.orphanCount}`);
  console.log(`Orphan bytes total: ${formatBytes(snapshot.orphanBytes)}`);
  console.log(`Selected candidates: ${candidates.length}`);
  console.log(`Selected bytes: ${formatBytes(candidateBytes)}`);

  if (candidates.length > 0) {
    console.log("Top candidates:");
    for (const entry of candidates.slice(0, 10)) {
      console.log(
        `- ${entry.bucketId}/${entry.path} (${formatBytes(entry.sizeBytes)})`,
      );
    }
  }

  if (!options.apply) {
    console.log(
      "Dry run only. Re-run with --apply to delete selected objects.",
    );
    return;
  }

  if (candidates.length === 0) {
    console.log("No selected candidates. Nothing to delete.");
    return;
  }

  await runApplyMode(candidates);
}

void main().catch((error) => {
  console.error("Storage cleanup failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
