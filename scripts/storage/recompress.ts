import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveImageType } from "@/lib/imageType";
import {
  buildVariantStoragePaths,
  createWebpVariants,
  isVariantStoragePath,
  shouldGenerateWebpVariants,
} from "@/lib/imageVariants";
import {
  createSupabaseAdminClient,
  formatBytes,
  getDefaultBuckets,
  parseStorageRefFromPublicUrl,
} from "./common";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type SourceTable = "Player" | "TeamRoleProfile";

interface ReferenceTarget {
  table: SourceTable;
  entityId: string;
  oldUrl: string;
  bucketId: string;
  path: string;
}

interface GroupedReference {
  bucketId: string;
  sourcePath: string;
  targets: ReferenceTarget[];
}

type OperationStatus =
  | "converted"
  | "skipped-already-variant"
  | "skipped-unsupported"
  | "failed";

interface OperationResult {
  bucketId: string;
  sourcePath: string;
  status: OperationStatus;
  reason?: string;
  sourceBytes?: number;
  detailPath?: string;
  thumbPath?: string;
  detailBytes?: number;
  thumbBytes?: number;
  updatedRecords?: number;
  deletedOriginal?: boolean;
}

interface CliOptions {
  apply: boolean;
  keepOriginals: boolean;
  limit: number | null;
  buckets: string[];
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

function parsePositiveInt(rawValue: string | undefined): number | null {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function parseCliOptions(argv: string[]): CliOptions {
  const apply = argv.includes("--apply");
  const keepOriginals = argv.includes("--keep-originals");

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
    keepOriginals,
    limit,
    buckets,
  };
}

function buildGroupKey(bucketId: string, path: string): string {
  return `${bucketId}/${path}`;
}

function removeLastExtension(pathname: string): string {
  const lastSlash = pathname.lastIndexOf("/");
  const lastDot = pathname.lastIndexOf(".");

  if (lastDot <= lastSlash) {
    return pathname;
  }

  return pathname.slice(0, lastDot);
}

function summarizeResults(results: OperationResult[]) {
  const summary = {
    total: results.length,
    converted: 0,
    skippedAlreadyVariant: 0,
    skippedUnsupported: 0,
    failed: 0,
    sourceBytes: 0,
    generatedBytes: 0,
    deletedOriginals: 0,
    updatedRecords: 0,
  };

  for (const result of results) {
    if (result.sourceBytes) {
      summary.sourceBytes += result.sourceBytes;
    }

    if (result.detailBytes) {
      summary.generatedBytes += result.detailBytes;
    }

    if (result.thumbBytes) {
      summary.generatedBytes += result.thumbBytes;
    }

    if (result.updatedRecords) {
      summary.updatedRecords += result.updatedRecords;
    }

    if (result.deletedOriginal) {
      summary.deletedOriginals += 1;
    }

    if (result.status === "converted") summary.converted += 1;
    if (result.status === "skipped-already-variant") {
      summary.skippedAlreadyVariant += 1;
    }
    if (result.status === "skipped-unsupported") {
      summary.skippedUnsupported += 1;
    }
    if (result.status === "failed") summary.failed += 1;
  }

  return summary;
}

function toDiffString(beforeBytes: number, afterBytes: number): string {
  const delta = afterBytes - beforeBytes;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatBytes(delta)} (${beforeBytes} -> ${afterBytes})`;
}

async function fetchReferenceTargets(
  buckets: string[],
): Promise<ReferenceTarget[]> {
  const supabase = createSupabaseAdminClient();

  const [playersRes, teamRolesRes] = await Promise.all([
    supabase.from("Player").select("id,imageUrl").not("imageUrl", "is", null),
    supabase
      .from("TeamRoleProfile")
      .select("id,imageUrl")
      .not("imageUrl", "is", null),
  ]);

  if (playersRes.error) throw playersRes.error;
  if (teamRolesRes.error) throw teamRolesRes.error;

  const allowed = new Set(buckets);
  const targets: ReferenceTarget[] = [];

  for (const row of playersRes.data ?? []) {
    if (!row.imageUrl) continue;

    const parsed = parseStorageRefFromPublicUrl(row.imageUrl);
    if (!parsed || !allowed.has(parsed.bucketId)) continue;

    targets.push({
      table: "Player",
      entityId: row.id,
      oldUrl: row.imageUrl,
      bucketId: parsed.bucketId,
      path: parsed.path,
    });
  }

  for (const row of teamRolesRes.data ?? []) {
    if (!row.imageUrl) continue;

    const parsed = parseStorageRefFromPublicUrl(row.imageUrl);
    if (!parsed || !allowed.has(parsed.bucketId)) continue;

    targets.push({
      table: "TeamRoleProfile",
      entityId: row.id,
      oldUrl: row.imageUrl,
      bucketId: parsed.bucketId,
      path: parsed.path,
    });
  }

  return targets;
}

function groupReferences(
  targets: ReferenceTarget[],
  limit: number | null,
): GroupedReference[] {
  const byPath = new Map<string, GroupedReference>();

  for (const target of targets) {
    const key = buildGroupKey(target.bucketId, target.path);
    const existing = byPath.get(key);

    if (existing) {
      existing.targets.push(target);
    } else {
      byPath.set(key, {
        bucketId: target.bucketId,
        sourcePath: target.path,
        targets: [target],
      });
    }
  }

  const grouped = [...byPath.values()].sort((a, b) =>
    a.sourcePath.localeCompare(b.sourcePath),
  );

  if (!limit || grouped.length <= limit) {
    return grouped;
  }

  return grouped.slice(0, limit);
}

async function updateRecordUrl(
  supabase: SupabaseAdminClient,
  table: SourceTable,
  entityId: string,
  imageUrl: string,
): Promise<void> {
  const nowIso = new Date().toISOString();

  if (table === "Player") {
    const { error } = await supabase
      .from("Player")
      .update({ imageUrl, updatedAt: nowIso })
      .eq("id", entityId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("TeamRoleProfile")
    .update({ imageUrl, updatedAt: nowIso })
    .eq("id", entityId);

  if (error) throw error;
}

async function updateIngestionMetadata(
  supabase: SupabaseAdminClient,
  sourcePath: string,
  detailPath: string,
  detailBytes: number,
): Promise<void> {
  const { error } = await supabase
    .from("ImportImageIngestionJob")
    .update({
      storagePath: detailPath,
      contentType: "image/webp",
      contentLength: detailBytes,
      updatedAt: new Date().toISOString(),
    })
    .eq("storagePath", sourcePath)
    .eq("status", "COMPLETED");

  if (error) throw error;
}

async function processGroup(
  group: GroupedReference,
  options: CliOptions,
): Promise<OperationResult> {
  const supabase = createSupabaseAdminClient();

  if (isVariantStoragePath(group.sourcePath)) {
    return {
      bucketId: group.bucketId,
      sourcePath: group.sourcePath,
      status: "skipped-already-variant",
      reason: "already points to detail/thumb variant",
    };
  }

  const { data, error } = await supabase.storage
    .from(group.bucketId)
    .download(group.sourcePath);

  if (error || !data) {
    return {
      bucketId: group.bucketId,
      sourcePath: group.sourcePath,
      status: "failed",
      reason: error?.message || "download failed",
    };
  }

  const sourceBytes = new Uint8Array(await data.arrayBuffer());
  if (sourceBytes.length === 0) {
    return {
      bucketId: group.bucketId,
      sourcePath: group.sourcePath,
      status: "failed",
      reason: "empty source object",
    };
  }

  const imageType = resolveImageType(data.type || null, sourceBytes);
  if (!imageType || !shouldGenerateWebpVariants(imageType)) {
    return {
      bucketId: group.bucketId,
      sourcePath: group.sourcePath,
      sourceBytes: sourceBytes.length,
      status: "skipped-unsupported",
      reason: "unsupported type for webp migration",
    };
  }

  const variants = await createWebpVariants(sourceBytes);
  if (!variants) {
    return {
      bucketId: group.bucketId,
      sourcePath: group.sourcePath,
      sourceBytes: sourceBytes.length,
      status: "skipped-unsupported",
      reason: "animated or unsupported image payload",
    };
  }

  const basePath = removeLastExtension(group.sourcePath);
  const { detailPath, thumbPath } = buildVariantStoragePaths(basePath);

  if (!options.apply) {
    return {
      bucketId: group.bucketId,
      sourcePath: group.sourcePath,
      status: "converted",
      sourceBytes: sourceBytes.length,
      detailPath,
      thumbPath,
      detailBytes: variants.detailBytes.length,
      thumbBytes: variants.thumbBytes.length,
      updatedRecords: group.targets.length,
      deletedOriginal: !options.keepOriginals,
    };
  }

  const [{ error: detailUploadError }, { error: thumbUploadError }] =
    await Promise.all([
      supabase.storage
        .from(group.bucketId)
        .upload(detailPath, variants.detailBytes, {
          upsert: true,
          cacheControl: "31536000",
          contentType: "image/webp",
        }),
      supabase.storage
        .from(group.bucketId)
        .upload(thumbPath, variants.thumbBytes, {
          upsert: true,
          cacheControl: "31536000",
          contentType: "image/webp",
        }),
    ]);

  if (detailUploadError) {
    return {
      bucketId: group.bucketId,
      sourcePath: group.sourcePath,
      status: "failed",
      reason: `detail upload failed: ${detailUploadError.message}`,
    };
  }

  if (thumbUploadError) {
    return {
      bucketId: group.bucketId,
      sourcePath: group.sourcePath,
      status: "failed",
      reason: `thumb upload failed: ${thumbUploadError.message}`,
    };
  }

  const detailUrl = supabase.storage
    .from(group.bucketId)
    .getPublicUrl(detailPath).data.publicUrl;

  if (!detailUrl) {
    return {
      bucketId: group.bucketId,
      sourcePath: group.sourcePath,
      status: "failed",
      reason: "failed to generate detail public URL",
    };
  }

  try {
    for (const target of group.targets) {
      await updateRecordUrl(supabase, target.table, target.entityId, detailUrl);
    }

    await updateIngestionMetadata(
      supabase,
      group.sourcePath,
      detailPath,
      variants.detailBytes.length,
    );
  } catch (updateError) {
    return {
      bucketId: group.bucketId,
      sourcePath: group.sourcePath,
      status: "failed",
      reason:
        updateError instanceof Error
          ? `db update failed: ${updateError.message}`
          : "db update failed",
      sourceBytes: sourceBytes.length,
      detailPath,
      thumbPath,
      detailBytes: variants.detailBytes.length,
      thumbBytes: variants.thumbBytes.length,
    };
  }

  let deletedOriginal = false;
  if (!options.keepOriginals) {
    const { error: removeError } = await supabase.storage
      .from(group.bucketId)
      .remove([group.sourcePath]);

    if (removeError) {
      return {
        bucketId: group.bucketId,
        sourcePath: group.sourcePath,
        status: "failed",
        reason: `original delete failed: ${removeError.message}`,
        sourceBytes: sourceBytes.length,
        detailPath,
        thumbPath,
        detailBytes: variants.detailBytes.length,
        thumbBytes: variants.thumbBytes.length,
        updatedRecords: group.targets.length,
      };
    }

    deletedOriginal = true;
  }

  return {
    bucketId: group.bucketId,
    sourcePath: group.sourcePath,
    status: "converted",
    sourceBytes: sourceBytes.length,
    detailPath,
    thumbPath,
    detailBytes: variants.detailBytes.length,
    thumbBytes: variants.thumbBytes.length,
    updatedRecords: group.targets.length,
    deletedOriginal,
  };
}

async function writeManifest(
  options: CliOptions,
  groups: GroupedReference[],
  results: OperationResult[],
): Promise<string> {
  await mkdir(join("docs", "reports"), { recursive: true });

  const summary = summarizeResults(results);
  const manifest = {
    generatedAt: new Date().toISOString(),
    applyMode: options.apply,
    keepOriginals: options.keepOriginals,
    selectedBuckets: options.buckets,
    groupsSelected: groups.length,
    summary: {
      ...summary,
      sourceBytesHuman: formatBytes(summary.sourceBytes),
      generatedBytesHuman: formatBytes(summary.generatedBytes),
      projectedDeltaHuman: toDiffString(
        summary.sourceBytes,
        summary.generatedBytes,
      ),
    },
    results,
  };

  const manifestPath = join(
    "docs",
    "reports",
    `storage-recompress-manifest-${timestampForFile()}.json`,
  );

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  return manifestPath;
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));

  const references = await fetchReferenceTargets(options.buckets);
  const groups = groupReferences(references, options.limit);

  console.log("Storage recompression target summary");
  console.log(`Buckets: ${options.buckets.join(", ")}`);
  console.log(`Reference rows found: ${references.length}`);
  console.log(`Unique storage objects selected: ${groups.length}`);
  console.log(`Mode: ${options.apply ? "apply" : "dry-run"}`);
  console.log(`Delete originals: ${options.keepOriginals ? "no" : "yes"}`);

  const results: OperationResult[] = [];

  for (const [index, group] of groups.entries()) {
    const result = await processGroup(group, options);
    results.push(result);

    const progress = `${index + 1}/${groups.length}`;
    if (result.status === "converted") {
      console.log(
        `[${progress}] converted ${group.bucketId}/${group.sourcePath} (${group.targets.length} refs)`,
      );
    } else {
      console.log(
        `[${progress}] ${result.status} ${group.bucketId}/${group.sourcePath} - ${result.reason ?? "n/a"}`,
      );
    }
  }

  const manifestPath = await writeManifest(options, groups, results);
  const summary = summarizeResults(results);

  console.log("Recompression summary");
  console.log(`Converted: ${summary.converted}`);
  console.log(`Skipped (already variant): ${summary.skippedAlreadyVariant}`);
  console.log(`Skipped (unsupported): ${summary.skippedUnsupported}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Updated records: ${summary.updatedRecords}`);
  console.log(
    `Source bytes scanned: ${formatBytes(summary.sourceBytes)} (${summary.sourceBytes})`,
  );
  console.log(
    `Generated variant bytes: ${formatBytes(summary.generatedBytes)} (${summary.generatedBytes})`,
  );
  console.log(
    `Projected delta: ${toDiffString(summary.sourceBytes, summary.generatedBytes)}`,
  );
  console.log(`Deleted originals: ${summary.deletedOriginals}`);
  console.log(`Manifest: ${manifestPath}`);

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error("Storage recompression failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
