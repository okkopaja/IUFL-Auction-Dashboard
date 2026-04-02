import { createHash } from "node:crypto";
import { classifyImageUrl } from "@/features/player-import/driveImage";
import { resolveImageType } from "@/lib/imageType";
import type { getSupabaseAdminClient } from "@/lib/supabase";
import type { TeamRole } from "@/types";

const ICON_IMAGES_BUCKET =
  process.env.ICON_IMAGES_BUCKET?.trim() || "icon-images";

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_UPLOAD_CONCURRENCY = 4;

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>;

interface UploadRoleImageInput {
  rowKey: string;
  sessionId: string;
  teamId: string;
  role: TeamRole;
  imageUrl: string;
}

interface UploadRoleImagesResult {
  publicUrlByRowKey: Map<string, string>;
  uploadedCount: number;
  warnings: string[];
  failures: Array<{
    rowKey: string;
    error: string;
  }>;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  const bounded = Math.max(1, Math.min(concurrency, values.length || 1));
  let index = 0;

  const runners = Array.from({ length: bounded }, async () => {
    while (index < values.length) {
      const current = index;
      index += 1;
      await worker(values[current]);
    }
  });

  await Promise.all(runners);
}

function buildStoragePath(
  input: UploadRoleImageInput,
  hashSourceUrl: string,
): string {
  const sourceHash = createHash("sha1")
    .update(hashSourceUrl)
    .digest("hex")
    .slice(0, 20);
  const roleKey = input.role.toLowerCase();

  return `team-role-icons/${input.sessionId}/${input.teamId}/${roleKey}/${sourceHash}`;
}

function resolveImageFetchSource(rawImageUrl: string): {
  fetchUrl: string;
  hashSourceUrl: string;
} {
  const classified = classifyImageUrl(rawImageUrl);

  if (classified.kind === "invalid") {
    throw new Error(classified.reason);
  }

  if (classified.kind === "drive") {
    return {
      fetchUrl: classified.drive.canonicalDownloadUrl,
      hashSourceUrl: classified.drive.canonicalDownloadUrl,
    };
  }

  if (classified.kind === "other") {
    return {
      fetchUrl: classified.normalizedUrl,
      hashSourceUrl: classified.normalizedUrl,
    };
  }

  throw new Error("Image URL is required");
}

export async function uploadRoleImagesFromUrls(
  supabase: SupabaseAdminClient,
  rows: UploadRoleImageInput[],
): Promise<UploadRoleImagesResult> {
  const warnings: string[] = [];
  const failures: Array<{
    rowKey: string;
    error: string;
  }> = [];
  const publicUrlByRowKey = new Map<string, string>();
  let uploadedCount = 0;

  const fetchTimeoutMs = toPositiveInt(
    process.env.ICON_IMAGE_FETCH_TIMEOUT_MS,
    DEFAULT_FETCH_TIMEOUT_MS,
  );
  const uploadConcurrency = toPositiveInt(
    process.env.ICON_IMAGE_UPLOAD_CONCURRENCY,
    DEFAULT_UPLOAD_CONCURRENCY,
  );

  await mapWithConcurrency(rows, uploadConcurrency, async (row) => {
    try {
      const source = resolveImageFetchSource(row.imageUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

      let response: Response;
      try {
        response = await fetch(source.fetchUrl, {
          method: "GET",
          signal: controller.signal,
          headers: {
            Accept: "image/*,*/*;q=0.8",
          },
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`Image URL returned ${response.status}`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0) {
        throw new Error("Image URL returned empty file");
      }

      const resolvedType = resolveImageType(
        response.headers.get("content-type"),
        bytes,
      );
      if (!resolvedType) {
        throw new Error("Image URL did not return a supported image format");
      }

      const storageBasePath = buildStoragePath(row, source.hashSourceUrl);
      const storagePath = `${storageBasePath}.${resolvedType.extension}`;

      const { error: uploadError } = await supabase.storage
        .from(ICON_IMAGES_BUCKET)
        .upload(storagePath, bytes, {
          upsert: true,
          contentType: resolvedType.contentType,
          cacheControl: "31536000",
        });

      if (uploadError) {
        throw new Error(`Supabase upload failed: ${uploadError.message}`);
      }

      const publicUrl = supabase.storage
        .from(ICON_IMAGES_BUCKET)
        .getPublicUrl(storagePath).data.publicUrl;

      if (!publicUrl) {
        throw new Error("Failed to generate public URL");
      }

      publicUrlByRowKey.set(row.rowKey, publicUrl);
      uploadedCount += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown upload error";

      warnings.push(
        `Row ${row.rowKey}: ${message}. Keeping original IMAGE URL as fallback.`,
      );
      failures.push({
        rowKey: row.rowKey,
        error: message,
      });
      publicUrlByRowKey.set(row.rowKey, row.imageUrl);
    }
  });

  return {
    publicUrlByRowKey,
    uploadedCount,
    warnings,
    failures,
  };
}
