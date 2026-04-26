import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildStorageSnapshot, formatBytes, getDefaultBuckets } from "./common";

function timestampForFile(date = new Date()): string {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const sec = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${sec}`;
}

function parseBucketsArg(argv: string[]): string[] {
  const value = argv.find((arg) => arg.startsWith("--buckets="));
  if (!value) return getDefaultBuckets();

  const list = value
    .split("=")[1]
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return list && list.length > 0 ? list : getDefaultBuckets();
}

async function main() {
  const buckets = parseBucketsArg(process.argv.slice(2));
  const snapshot = await buildStorageSnapshot(buckets);

  const topLargest = [...snapshot.objects]
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, 20)
    .map((entry) => ({
      bucketId: entry.bucketId,
      path: entry.path,
      sizeBytes: entry.sizeBytes,
      size: formatBytes(entry.sizeBytes),
      isOrphan: entry.isOrphan,
      referenceCount: entry.references.length,
    }));

  const orphanLargest = snapshot.objects
    .filter((entry) => entry.isOrphan)
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, 20)
    .map((entry) => ({
      bucketId: entry.bucketId,
      path: entry.path,
      sizeBytes: entry.sizeBytes,
      size: formatBytes(entry.sizeBytes),
      isLikelyTest: entry.isLikelyTest,
    }));

  const report = {
    ...snapshot,
    summary: {
      total: formatBytes(snapshot.totalBytes),
      orphan: formatBytes(snapshot.orphanBytes),
      referenced: formatBytes(snapshot.referencedBytes),
    },
    topLargest,
    orphanLargest,
  };

  await mkdir(join("docs", "reports"), { recursive: true });
  const reportPath = join(
    "docs",
    "reports",
    `storage-audit-${timestampForFile()}.json`,
  );

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("Storage audit complete");
  console.log(`Buckets: ${snapshot.buckets.join(", ")}`);
  console.log(`Objects: ${snapshot.objectCount}`);
  console.log(`Total size: ${formatBytes(snapshot.totalBytes)}`);
  console.log(
    `Referenced: ${snapshot.referencedCount} objects / ${formatBytes(snapshot.referencedBytes)}`,
  );
  console.log(
    `Orphan: ${snapshot.orphanCount} objects / ${formatBytes(snapshot.orphanBytes)}`,
  );
  console.log(`Report: ${reportPath}`);
}

void main().catch((error) => {
  console.error("Storage audit failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
