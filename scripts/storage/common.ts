import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const DEFAULT_PLAYER_BUCKET = "player-images";
const DEFAULT_ICON_BUCKET = "icon-images";

type StorageObjectRow = {
  bucket_id: string;
  name: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ReferenceSource = "player" | "team-role" | "ingestion-job";

export interface StorageReference {
  source: ReferenceSource;
  entityId: string;
  bucketId: string;
  path: string;
}

export interface StorageObjectEntry {
  bucketId: string;
  path: string;
  sizeBytes: number;
  createdAt: string | null;
  updatedAt: string | null;
  isLikelyTest: boolean;
  references: StorageReference[];
  isOrphan: boolean;
}

export interface StorageSnapshot {
  generatedAt: string;
  buckets: string[];
  objectCount: number;
  totalBytes: number;
  orphanCount: number;
  orphanBytes: number;
  referencedCount: number;
  referencedBytes: number;
  objects: StorageObjectEntry[];
  references: StorageReference[];
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function getDefaultBuckets(): string[] {
  const playerBucket =
    process.env.PLAYER_IMAGES_BUCKET?.trim() || DEFAULT_PLAYER_BUCKET;
  const iconBucket =
    process.env.ICON_IMAGES_BUCKET?.trim() || DEFAULT_ICON_BUCKET;

  return [...new Set([playerBucket, iconBucket])];
}

export function createSupabaseAdminClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function normalizePath(rawPath: string): string {
  return rawPath.replace(/^\/+/, "").trim();
}

export function parseStorageRefFromPublicUrl(
  rawUrl: string | null | undefined,
): { bucketId: string; path: string } | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const prefixes = [
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/",
    ];

    const prefix = prefixes.find((candidate) =>
      parsed.pathname.includes(candidate),
    );

    if (!prefix) return null;

    const [bucketId, ...pathSegments] = parsed.pathname
      .split(prefix)[1]
      .split("/")
      .filter(Boolean);

    if (!bucketId || pathSegments.length === 0) return null;

    return {
      bucketId,
      path: normalizePath(decodeURIComponent(pathSegments.join("/"))),
    };
  } catch {
    return null;
  }
}

function readSize(metadata: Record<string, unknown> | null): number {
  const value = metadata?.size;
  const size =
    typeof value === "string" || typeof value === "number"
      ? Number(value)
      : NaN;

  if (!Number.isFinite(size) || size < 0) return 0;
  return Math.round(size);
}

function isLikelyTestPath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    /(^|\/)(test|tests|tmp|temp|debug|draft|sample)(\/|$)/.test(lower) ||
    lower.includes("mock")
  );
}

async function fetchStorageObjects(
  buckets: string[],
): Promise<StorageObjectRow[]> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  const rows: StorageObjectRow[] = [];

  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .schema("storage")
      .from("objects")
      .select("bucket_id,name,metadata,created_at,updated_at")
      .in("bucket_id", buckets)
      .order("name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    const page = (data ?? []) as StorageObjectRow[];
    if (page.length === 0) break;

    rows.push(...page);

    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function fetchReferences(
  playerBucket: string,
): Promise<StorageReference[]> {
  const supabase = createSupabaseAdminClient();

  const [playersRes, teamRolesRes, ingestionRes] = await Promise.all([
    supabase.from("Player").select("id,imageUrl").not("imageUrl", "is", null),
    supabase
      .from("TeamRoleProfile")
      .select("id,imageUrl")
      .not("imageUrl", "is", null),
    supabase
      .from("ImportImageIngestionJob")
      .select("id,storagePath")
      .not("storagePath", "is", null),
  ]);

  if (playersRes.error) throw playersRes.error;
  if (teamRolesRes.error) throw teamRolesRes.error;
  if (ingestionRes.error) throw ingestionRes.error;

  const references: StorageReference[] = [];

  for (const row of playersRes.data ?? []) {
    const parsed = parseStorageRefFromPublicUrl(row.imageUrl);
    if (!parsed) continue;

    references.push({
      source: "player",
      entityId: row.id,
      bucketId: parsed.bucketId,
      path: parsed.path,
    });
  }

  for (const row of teamRolesRes.data ?? []) {
    const parsed = parseStorageRefFromPublicUrl(row.imageUrl);
    if (!parsed) continue;

    references.push({
      source: "team-role",
      entityId: row.id,
      bucketId: parsed.bucketId,
      path: parsed.path,
    });
  }

  for (const row of ingestionRes.data ?? []) {
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

function toReferenceMap(
  references: StorageReference[],
): Map<string, StorageReference[]> {
  const map = new Map<string, StorageReference[]>();

  for (const reference of references) {
    const key = `${reference.bucketId}/${reference.path}`;
    const list = map.get(key);
    if (list) {
      list.push(reference);
    } else {
      map.set(key, [reference]);
    }
  }

  return map;
}

export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = sizeBytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export async function buildStorageSnapshot(
  buckets = getDefaultBuckets(),
): Promise<StorageSnapshot> {
  const playerBucket =
    process.env.PLAYER_IMAGES_BUCKET?.trim() || DEFAULT_PLAYER_BUCKET;

  const [rawObjects, references] = await Promise.all([
    fetchStorageObjects(buckets),
    fetchReferences(playerBucket),
  ]);

  const referenceMap = toReferenceMap(references);

  const objects: StorageObjectEntry[] = rawObjects.map((row) => {
    const path = normalizePath(row.name);
    const key = `${row.bucket_id}/${path}`;
    const refs = referenceMap.get(key) ?? [];
    const sizeBytes = readSize(row.metadata);

    return {
      bucketId: row.bucket_id,
      path,
      sizeBytes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isLikelyTest: isLikelyTestPath(path),
      references: refs,
      isOrphan: refs.length === 0,
    };
  });

  const totals = objects.reduce(
    (acc, object) => {
      acc.totalBytes += object.sizeBytes;
      if (object.isOrphan) {
        acc.orphanBytes += object.sizeBytes;
        acc.orphanCount += 1;
      } else {
        acc.referencedBytes += object.sizeBytes;
        acc.referencedCount += 1;
      }
      return acc;
    },
    {
      totalBytes: 0,
      orphanBytes: 0,
      orphanCount: 0,
      referencedBytes: 0,
      referencedCount: 0,
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    buckets,
    objectCount: objects.length,
    totalBytes: totals.totalBytes,
    orphanCount: totals.orphanCount,
    orphanBytes: totals.orphanBytes,
    referencedCount: totals.referencedCount,
    referencedBytes: totals.referencedBytes,
    objects,
    references,
  };
}

export function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}
