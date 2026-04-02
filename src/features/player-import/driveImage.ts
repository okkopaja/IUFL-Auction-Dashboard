import type { ImportCheckIssue, ImportCommitRow } from "./types";

const DRIVE_HOST_ALLOWLIST = new Set([
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
]);

const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;

const DEFAULT_CHECK_TIMEOUT_MS = 8000;
const DEFAULT_CHECK_CONCURRENCY = 3;
const DEFAULT_CHECK_CACHE_TTL_MS = 10 * 60 * 1000;

export interface DriveImageRef {
  fileId: string;
  canonicalDownloadUrl: string;
  normalizedUrl: string;
}

export type ClassifiedImageUrl =
  | { kind: "empty" }
  | { kind: "invalid"; reason: string }
  | { kind: "other"; normalizedUrl: string }
  | { kind: "drive"; drive: DriveImageRef };

export type DrivePublicAccessState =
  | "public"
  | "non_public"
  | "transient_error";

export interface DrivePublicAccessResult {
  state: DrivePublicAccessState;
  message?: string;
  contentType?: string | null;
}

const globals = globalThis as typeof globalThis & {
  __drivePublicAccessCache?: Map<
    string,
    { result: DrivePublicAccessResult; expiresAt: number }
  >;
};

const drivePublicAccessCache =
  globals.__drivePublicAccessCache ??
  new Map<string, { result: DrivePublicAccessResult; expiresAt: number }>();
if (!globals.__drivePublicAccessCache) {
  globals.__drivePublicAccessCache = drivePublicAccessCache;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const DRIVE_CHECK_TIMEOUT_MS = toPositiveInt(
  process.env.PLAYER_IMPORT_DRIVE_CHECK_TIMEOUT_MS,
  DEFAULT_CHECK_TIMEOUT_MS,
);
const DRIVE_CHECK_CONCURRENCY = toPositiveInt(
  process.env.PLAYER_IMPORT_DRIVE_CHECK_CONCURRENCY,
  DEFAULT_CHECK_CONCURRENCY,
);
const DRIVE_CHECK_CACHE_TTL_MS = toPositiveInt(
  process.env.PLAYER_IMPORT_DRIVE_CHECK_CACHE_TTL_MS,
  DEFAULT_CHECK_CACHE_TTL_MS,
);

function pruneAccessCache(): void {
  const now = Date.now();
  for (const [key, value] of drivePublicAccessCache.entries()) {
    if (value.expiresAt <= now) {
      drivePublicAccessCache.delete(key);
    }
  }
}

function readAccessCache(fileId: string): DrivePublicAccessResult | null {
  pruneAccessCache();
  return drivePublicAccessCache.get(fileId)?.result ?? null;
}

function writeAccessCache(
  fileId: string,
  result: DrivePublicAccessResult,
): void {
  if (result.state === "transient_error") return;

  drivePublicAccessCache.set(fileId, {
    result,
    expiresAt: Date.now() + DRIVE_CHECK_CACHE_TTL_MS,
  });
}

function sanitizeFileId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return FILE_ID_PATTERN.test(trimmed) ? trimmed : null;
}

function extractPathFileId(pathname: string): string | null {
  const directMatch = pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
  if (directMatch?.[1]) return directMatch[1];

  const docMatch = pathname.match(/\/d\/([A-Za-z0-9_-]{10,})/);
  if (docMatch?.[1]) return docMatch[1];

  return null;
}

const DRIVE_API_MEDIA_BASE_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_API_KEY =
  process.env.GWS_DRIVE_API_KEY?.trim() ||
  process.env.GOOGLE_DRIVE_API_KEY?.trim() ||
  process.env.GOOGLE_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_API_KEY?.trim() ||
  "";

export function buildDriveDownloadUrl(fileId: string): string {
  const safeFileId = sanitizeFileId(fileId);
  if (!safeFileId) {
    throw new Error(
      "Google Drive download URL build failed: missing or invalid file id",
    );
  }

  const url = new URL(
    `${DRIVE_API_MEDIA_BASE_URL}/${encodeURIComponent(safeFileId)}`,
  );
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");
  if (DRIVE_API_KEY) {
    url.searchParams.set("key", DRIVE_API_KEY);
  }
  return url.toString();
}

export function classifyImageUrl(
  rawUrl: string | null | undefined,
): ClassifiedImageUrl {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return { kind: "empty" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      kind: "invalid",
      reason: "Image URL is not a valid URL",
    };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return {
      kind: "invalid",
      reason: "Image URL must use http or https",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!DRIVE_HOST_ALLOWLIST.has(hostname)) {
    return {
      kind: "other",
      normalizedUrl: parsed.toString(),
    };
  }

  const queryId = sanitizeFileId(parsed.searchParams.get("id"));
  const pathId = sanitizeFileId(extractPathFileId(parsed.pathname));
  const fileId = queryId ?? pathId;

  if (!fileId) {
    return {
      kind: "invalid",
      reason: "Google Drive URL does not contain a valid file id",
    };
  }

  return {
    kind: "drive",
    drive: {
      fileId,
      canonicalDownloadUrl: buildDriveDownloadUrl(fileId),
      normalizedUrl: parsed.toString(),
    },
  };
}

function isHtmlLikeResponse(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  return contentType.toLowerCase().includes("text/html");
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function checkDriveFilePublicAccess(
  fileId: string,
  timeoutMs = DRIVE_CHECK_TIMEOUT_MS,
): Promise<DrivePublicAccessResult> {
  const cached = readAccessCache(fileId);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildDriveDownloadUrl(fileId), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "image/*,*/*;q=0.8",
        // We only need headers/public-access verdict, not full image bytes.
        Range: "bytes=0-0",
      },
    });

    const contentType = response.headers.get("content-type");

    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404
    ) {
      const result: DrivePublicAccessResult = {
        state: "non_public",
        message: "Non public drive URL detected",
        contentType,
      };
      writeAccessCache(fileId, result);
      return result;
    }

    if (!response.ok) {
      const result: DrivePublicAccessResult = {
        state: isRetryableStatus(response.status)
          ? "transient_error"
          : "non_public",
        message: `Drive URL check returned ${response.status}`,
        contentType,
      };
      writeAccessCache(fileId, result);
      return result;
    }

    if (isHtmlLikeResponse(contentType)) {
      const result: DrivePublicAccessResult = {
        state: "non_public",
        message: "Non public drive URL detected",
        contentType,
      };
      writeAccessCache(fileId, result);
      return result;
    }

    const result: DrivePublicAccessResult = {
      state: "public",
      contentType,
    };
    writeAccessCache(fileId, result);
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        state: "transient_error",
        message: "Timed out while checking Drive URL",
      };
    }

    return {
      state: "transient_error",
      message: "Drive URL check failed due to network error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  if (values.length === 0) return;
  const bounded = Math.max(1, Math.min(concurrency, values.length));
  let index = 0;

  const runners = Array.from({ length: bounded }, async () => {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= values.length) break;
      await worker(values[currentIndex]);
    }
  });

  await Promise.all(runners);
}

export async function buildDriveImageImportIssues(
  rows: ImportCommitRow[],
  options?: { concurrency?: number; timeoutMs?: number },
): Promise<Map<string, ImportCheckIssue[]>> {
  const issuesByRowKey = new Map<string, ImportCheckIssue[]>();
  const rowKeysByDriveFileId = new Map<string, string[]>();

  for (const row of rows) {
    const classified = classifyImageUrl(row.imageUrl);

    if (classified.kind === "empty" || classified.kind === "other") {
      continue;
    }

    if (classified.kind === "invalid") {
      issuesByRowKey.set(row.rowKey, [
        {
          code: "INVALID_IMAGE_URL",
          severity: "blocking",
          field: "imageUrl",
          message: classified.reason,
        },
      ]);
      continue;
    }

    const rowKeys = rowKeysByDriveFileId.get(classified.drive.fileId) ?? [];
    rowKeys.push(row.rowKey);
    rowKeysByDriveFileId.set(classified.drive.fileId, rowKeys);
  }

  const uniqueDriveFileIds = [...rowKeysByDriveFileId.keys()];

  await mapWithConcurrency(
    uniqueDriveFileIds,
    options?.concurrency ?? DRIVE_CHECK_CONCURRENCY,
    async (fileId) => {
      const access = await checkDriveFilePublicAccess(
        fileId,
        options?.timeoutMs ?? DRIVE_CHECK_TIMEOUT_MS,
      );

      if (access.state === "public") return;

      const affectedRowKeys = rowKeysByDriveFileId.get(fileId) ?? [];

      if (access.state === "non_public") {
        for (const rowKey of affectedRowKeys) {
          issuesByRowKey.set(rowKey, [
            {
              code: "DRIVE_URL_NON_PUBLIC",
              severity: "blocking",
              field: "imageUrl",
              message: "Non public drive URL detected",
            },
          ]);
        }
        return;
      }

      for (const rowKey of affectedRowKeys) {
        issuesByRowKey.set(rowKey, [
          {
            code: "DRIVE_URL_CHECK_FAILED",
            severity: "warning",
            field: "imageUrl",
            message: access.message ?? "Drive URL check failed temporarily",
          },
        ]);
      }
    },
  );

  return issuesByRowKey;
}
