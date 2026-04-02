import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveImageType } from "@/lib/imageType";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/supabase";
import { buildDriveDownloadUrl, classifyImageUrl } from "./driveImage";
import type {
  ImportImageIngestionFailureRow,
  ImportImageIngestionProgress,
  ImportImageRunStatus,
} from "./types";

type SupabaseAdminClient = SupabaseClient<Database>;
type IngestionRunRow =
  Database["public"]["Tables"]["ImportImageIngestionRun"]["Row"];
type IngestionJobRow =
  Database["public"]["Tables"]["ImportImageIngestionJob"]["Row"];

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_PROCESS_BATCH_SIZE = 12;
const DEFAULT_PROCESS_CONCURRENCY = 3;
const DEFAULT_FETCH_TIMEOUT_MS = 20000;
const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_RETRY_BASE_MS = 1000;
const DEFAULT_RETRY_MAX_MS = 30000;

const PLAYER_IMAGES_BUCKET =
  process.env.PLAYER_IMAGES_BUCKET?.trim() || "player-images";

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const IMAGE_MAX_BYTES = toPositiveInt(
  process.env.PLAYER_IMAGE_MAX_BYTES,
  DEFAULT_MAX_IMAGE_BYTES,
);
const IMAGE_FETCH_TIMEOUT_MS = toPositiveInt(
  process.env.PLAYER_IMAGE_FETCH_TIMEOUT_MS,
  DEFAULT_FETCH_TIMEOUT_MS,
);

function truncateErrorMessage(message: string, maxLength = 280): string {
  if (message.length <= maxLength) return message;
  return `${message.slice(0, maxLength - 3)}...`;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function hashSourceUrl(sourceUrl: string): string {
  return createHash("sha256")
    .update(sourceUrl.trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
}

function buildStoragePath(
  sessionId: string,
  playerId: string,
  sourceHash: string,
  extension: string,
): string {
  return `players/${sessionId}/${playerId}/${sourceHash}.${extension}`;
}

function toProgress(
  run: IngestionRunRow,
  counts: {
    pendingJobs: number;
    inProgressJobs: number;
    completedJobs: number;
    failedJobs: number;
  },
  failedRows: ImportImageIngestionFailureRow[],
): ImportImageIngestionProgress {
  const percent =
    run.totalJobs === 0
      ? 100
      : Math.round(
          ((counts.completedJobs + counts.failedJobs) / run.totalJobs) * 100,
        );

  return {
    runId: run.id,
    status: run.status as ImportImageRunStatus,
    totalJobs: run.totalJobs,
    completedJobs: counts.completedJobs,
    failedJobs: counts.failedJobs,
    pendingJobs: counts.pendingJobs,
    inProgressJobs: counts.inProgressJobs,
    percent: Math.max(0, Math.min(100, percent)),
    failedRows,
  };
}

async function fetchFailedRows(
  supabase: SupabaseAdminClient,
  runId: string,
): Promise<ImportImageIngestionFailureRow[]> {
  const { data: failedJobs, error: failedJobsError } = await supabase
    .from("ImportImageIngestionJob")
    .select("playerId,sourceUrl,lastError,updatedAt")
    .eq("runId", runId)
    .eq("status", "FAILED")
    .order("updatedAt", { ascending: true });

  if (failedJobsError) throw failedJobsError;

  if (!failedJobs || failedJobs.length === 0) {
    return [];
  }

  const playerIds = [...new Set(failedJobs.map((job) => job.playerId))];
  const { data: players, error: playersError } = await supabase
    .from("Player")
    .select("id,name,importOrder")
    .in("id", playerIds);

  if (playersError) throw playersError;

  const playersById = new Map(
    (players ?? []).map((player) => [player.id, player]),
  );

  return failedJobs
    .map((job, index) => {
      const player = playersById.get(job.playerId);

      return {
        rowNumber:
          typeof player?.importOrder === "number"
            ? player.importOrder + 1
            : index + 1,
        playerId: job.playerId,
        playerName: player?.name ?? "Unknown player",
        imageUrl: job.sourceUrl,
        error: job.lastError ?? "Unknown ingestion error",
      };
    })
    .sort((a, b) => a.rowNumber - b.rowNumber);
}

function deriveRunStatus(counts: {
  pendingJobs: number;
  inProgressJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalJobs: number;
}): ImportImageRunStatus {
  if (counts.totalJobs === 0) {
    return "COMPLETED";
  }

  if (counts.pendingJobs === 0 && counts.inProgressJobs === 0) {
    return counts.failedJobs > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
  }

  if (
    counts.completedJobs > 0 ||
    counts.failedJobs > 0 ||
    counts.inProgressJobs > 0
  ) {
    return "PROCESSING";
  }

  return "PENDING";
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
      const current = index;
      index += 1;
      if (current >= values.length) break;
      await worker(values[current]);
    }
  });

  await Promise.all(runners);
}

export async function syncImageIngestionRun(
  supabase: SupabaseAdminClient,
  runId: string,
): Promise<ImportImageIngestionProgress | null> {
  const { data: run, error: runError } = await supabase
    .from("ImportImageIngestionRun")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (runError) throw runError;
  if (!run) return null;

  const { data: jobs, error: jobsError } = await supabase
    .from("ImportImageIngestionJob")
    .select("status")
    .eq("runId", runId);

  if (jobsError) throw jobsError;

  const counts = {
    pendingJobs: 0,
    inProgressJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
  };

  for (const job of jobs ?? []) {
    if (job.status === "PENDING") counts.pendingJobs += 1;
    if (job.status === "IN_PROGRESS") counts.inProgressJobs += 1;
    if (job.status === "COMPLETED") counts.completedJobs += 1;
    if (job.status === "FAILED") counts.failedJobs += 1;
  }

  const status = deriveRunStatus({
    ...counts,
    totalJobs: run.totalJobs,
  });

  const nowIso = new Date().toISOString();
  const updatePayload: Database["public"]["Tables"]["ImportImageIngestionRun"]["Update"] =
    {
      status,
      completedJobs: counts.completedJobs,
      failedJobs: counts.failedJobs,
      updatedAt: nowIso,
    };

  if (
    !run.startedAt &&
    (counts.inProgressJobs > 0 ||
      counts.completedJobs > 0 ||
      counts.failedJobs > 0)
  ) {
    updatePayload.startedAt = nowIso;
  }

  if (status === "COMPLETED" || status === "COMPLETED_WITH_ERRORS") {
    updatePayload.finishedAt = run.finishedAt ?? nowIso;
  } else {
    updatePayload.finishedAt = null;
  }

  const { data: updatedRun, error: updateError } = await supabase
    .from("ImportImageIngestionRun")
    .update(updatePayload)
    .eq("id", runId)
    .select("*")
    .maybeSingle();

  if (updateError) throw updateError;

  const finalRun = updatedRun ?? run;
  const failedRows =
    counts.failedJobs > 0 ? await fetchFailedRows(supabase, runId) : [];
  return toProgress(finalRun, counts, failedRows);
}

export async function enqueueDriveImageIngestionRun(
  supabase: SupabaseAdminClient,
  sessionId: string,
  playerImageAssignments: Array<{
    playerId: string;
    imageUrl: string | null | undefined;
  }>,
): Promise<ImportImageIngestionProgress | null> {
  const nowIso = new Date().toISOString();

  const jobs: Database["public"]["Tables"]["ImportImageIngestionJob"]["Insert"][] =
    [];
  const seen = new Set<string>();

  for (const assignment of playerImageAssignments) {
    const classified = classifyImageUrl(assignment.imageUrl);
    if (classified.kind === "empty") continue;

    const sourceUrl =
      classified.kind === "drive"
        ? classified.drive.normalizedUrl
        : classified.kind === "other"
          ? classified.normalizedUrl
          : (assignment.imageUrl ?? "").trim();

    const sourceHash = hashSourceUrl(sourceUrl);
    const dedupeKey = `${assignment.playerId}:${sourceHash}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    if (classified.kind === "invalid" || classified.kind === "other") {
      jobs.push({
        id: crypto.randomUUID(),
        runId: "",
        sessionId,
        playerId: assignment.playerId,
        sourceUrl,
        sourceFileId: `invalid-${sourceHash}`,
        sourceHash,
        status: "FAILED",
        attemptCount: 0,
        maxAttempts: 0,
        nextAttemptAt: null,
        lastError:
          classified.kind === "invalid"
            ? classified.reason
            : "Image URL host is not supported. Use a public Google Drive URL",
        createdAt: nowIso,
        updatedAt: nowIso,
        finishedAt: nowIso,
      });
      continue;
    }

    jobs.push({
      id: crypto.randomUUID(),
      runId: "",
      sessionId,
      playerId: assignment.playerId,
      sourceUrl: classified.drive.normalizedUrl,
      sourceFileId: classified.drive.fileId,
      sourceHash,
      status: "PENDING",
      attemptCount: 0,
      maxAttempts: toPositiveInt(
        process.env.PLAYER_IMAGE_MAX_ATTEMPTS,
        DEFAULT_MAX_ATTEMPTS,
      ),
      nextAttemptAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  if (jobs.length === 0) {
    return null;
  }

  const runId = crypto.randomUUID();

  const { error: runInsertError } = await supabase
    .from("ImportImageIngestionRun")
    .insert({
      id: runId,
      sessionId,
      status: "PENDING",
      totalJobs: jobs.length,
      completedJobs: 0,
      failedJobs: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

  if (runInsertError) throw runInsertError;

  const preparedJobs = jobs.map((job) => ({
    ...job,
    runId,
  }));

  const { error: jobsInsertError } = await supabase
    .from("ImportImageIngestionJob")
    .insert(preparedJobs);

  if (jobsInsertError) throw jobsInsertError;

  return syncImageIngestionRun(supabase, runId);
}

class IngestionError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

async function fetchDriveImage(job: IngestionJobRow): Promise<{
  buffer: Buffer;
  contentType: string | null;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(buildDriveDownloadUrl(job.sourceFileId), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "image/*,*/*;q=0.8",
      },
    });

    const contentType = response.headers.get("content-type");
    const contentLengthHeader = response.headers.get("content-length");
    const contentLength = contentLengthHeader
      ? Number(contentLengthHeader)
      : null;

    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404
    ) {
      throw new IngestionError("Non public drive URL detected", false);
    }

    if (!response.ok) {
      throw new IngestionError(
        `Drive download failed with status ${response.status}`,
        isRetryableStatus(response.status),
      );
    }

    if (contentType?.toLowerCase().includes("text/html")) {
      throw new IngestionError("Non public drive URL detected", false);
    }

    if (
      contentLength !== null &&
      Number.isFinite(contentLength) &&
      contentLength > IMAGE_MAX_BYTES
    ) {
      throw new IngestionError(
        `Image too large (${contentLength} bytes). Limit is ${IMAGE_MAX_BYTES} bytes`,
        false,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > IMAGE_MAX_BYTES) {
      throw new IngestionError(
        `Image too large (${buffer.length} bytes). Limit is ${IMAGE_MAX_BYTES} bytes`,
        false,
      );
    }

    return {
      buffer,
      contentType,
    };
  } catch (error) {
    if (error instanceof IngestionError) throw error;

    if (error instanceof Error && error.name === "AbortError") {
      throw new IngestionError("Drive download timed out", true);
    }

    throw new IngestionError(
      "Drive download failed due to network error",
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function calculateRetryDelayMs(attemptCount: number): number {
  const base = toPositiveInt(
    process.env.PLAYER_IMAGE_RETRY_BASE_MS,
    DEFAULT_RETRY_BASE_MS,
  );
  const maxDelay = toPositiveInt(
    process.env.PLAYER_IMAGE_RETRY_MAX_MS,
    DEFAULT_RETRY_MAX_MS,
  );
  const exponential = Math.min(
    maxDelay,
    base * 2 ** Math.max(0, attemptCount - 1),
  );
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(maxDelay, exponential + jitter);
}

async function markJobFailure(
  supabase: SupabaseAdminClient,
  job: IngestionJobRow,
  error: IngestionError,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const canRetry = error.retryable && job.attemptCount < job.maxAttempts;

  const updatePayload: Database["public"]["Tables"]["ImportImageIngestionJob"]["Update"] =
    {
      status: canRetry ? "PENDING" : "FAILED",
      nextAttemptAt: canRetry
        ? new Date(
            Date.now() + calculateRetryDelayMs(job.attemptCount),
          ).toISOString()
        : null,
      lastError: truncateErrorMessage(error.message),
      finishedAt: canRetry ? null : nowIso,
      updatedAt: nowIso,
    };

  const { error: updateError } = await supabase
    .from("ImportImageIngestionJob")
    .update(updatePayload)
    .eq("id", job.id);

  if (updateError) throw updateError;
}

async function processClaimedJob(
  supabase: SupabaseAdminClient,
  job: IngestionJobRow,
): Promise<void> {
  try {
    const fetched = await fetchDriveImage(job);
    const resolvedType = resolveImageType(fetched.contentType, fetched.buffer);
    if (!resolvedType) {
      throw new IngestionError(
        "Downloaded file is not a supported image format",
        false,
      );
    }

    const storagePath = buildStoragePath(
      job.sessionId,
      job.playerId,
      job.sourceHash,
      resolvedType.extension,
    );

    const { error: uploadError } = await supabase.storage
      .from(PLAYER_IMAGES_BUCKET)
      .upload(storagePath, fetched.buffer, {
        upsert: true,
        contentType: resolvedType.contentType,
        cacheControl: "31536000",
      });

    if (uploadError) {
      throw new IngestionError(
        `Supabase upload failed: ${uploadError.message}`,
        true,
      );
    }

    const publicUrl = supabase.storage
      .from(PLAYER_IMAGES_BUCKET)
      .getPublicUrl(storagePath).data.publicUrl;

    const nowIso = new Date().toISOString();

    const { error: playerUpdateError } = await supabase
      .from("Player")
      .update({ imageUrl: publicUrl, updatedAt: nowIso })
      .eq("id", job.playerId)
      .eq("sessionId", job.sessionId);

    if (playerUpdateError) {
      throw new IngestionError(
        `Failed to update player image URL: ${playerUpdateError.message}`,
        true,
      );
    }

    const { error: jobUpdateError } = await supabase
      .from("ImportImageIngestionJob")
      .update({
        status: "COMPLETED",
        storagePath,
        contentType: resolvedType.contentType,
        contentLength: fetched.buffer.length,
        nextAttemptAt: null,
        lastError: null,
        finishedAt: nowIso,
        updatedAt: nowIso,
      })
      .eq("id", job.id);

    if (jobUpdateError) {
      throw new IngestionError(
        `Failed to finalize ingestion job: ${jobUpdateError.message}`,
        true,
      );
    }
  } catch (error) {
    const ingestionError =
      error instanceof IngestionError
        ? error
        : new IngestionError("Unexpected ingestion error", true);

    await markJobFailure(supabase, job, ingestionError);
    logger.warn("Player image ingestion job failed", {
      jobId: job.id,
      runId: job.runId,
      retryable: ingestionError.retryable,
      message: ingestionError.message,
    });
  }
}

async function claimPendingJob(
  supabase: SupabaseAdminClient,
  job: IngestionJobRow,
): Promise<IngestionJobRow | null> {
  const nowIso = new Date().toISOString();
  const { data: claimed, error } = await supabase
    .from("ImportImageIngestionJob")
    .update({
      status: "IN_PROGRESS",
      attemptCount: job.attemptCount + 1,
      startedAt: nowIso,
      updatedAt: nowIso,
      lastError: null,
    })
    .eq("id", job.id)
    .eq("status", "PENDING")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return claimed ?? null;
}

export async function processImageIngestionRun(
  supabase: SupabaseAdminClient,
  runId: string,
  options?: { maxJobs?: number; concurrency?: number },
): Promise<ImportImageIngestionProgress | null> {
  const maxJobs = Math.max(1, options?.maxJobs ?? DEFAULT_PROCESS_BATCH_SIZE);
  const concurrency = Math.max(
    1,
    options?.concurrency ?? DEFAULT_PROCESS_CONCURRENCY,
  );

  const candidateLimit = Math.max(maxJobs, maxJobs * 3);
  const now = Date.now();

  const { data: pendingJobs, error: pendingError } = await supabase
    .from("ImportImageIngestionJob")
    .select("*")
    .eq("runId", runId)
    .eq("status", "PENDING")
    .order("createdAt", { ascending: true })
    .limit(candidateLimit);

  if (pendingError) throw pendingError;

  const dueJobs = (pendingJobs ?? [])
    .filter(
      (job) =>
        !job.nextAttemptAt || new Date(job.nextAttemptAt).getTime() <= now,
    )
    .slice(0, maxJobs);

  const claimedJobs: IngestionJobRow[] = [];

  for (const job of dueJobs) {
    const claimed = await claimPendingJob(supabase, job);
    if (claimed) claimedJobs.push(claimed);
  }

  await mapWithConcurrency(claimedJobs, concurrency, async (claimedJob) => {
    await processClaimedJob(supabase, claimedJob);
  });

  return syncImageIngestionRun(supabase, runId);
}
