import type { TeamRole } from "@/types";
import { uploadRoleImagesFromUrls } from "./imageUpload";
import type {
  IconsImportImageIngestionFailureRow,
  IconsImportImageIngestionProgress,
  IconsImportImageRunStatus,
} from "./types";
import type { getSupabaseAdminClient } from "@/lib/supabase";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>;

type IngestionJobStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

interface IconsImageIngestionJob {
  id: string;
  rowKey: string;
  rowNumber: number;
  name: string;
  teamId: string;
  teamName: string;
  role: TeamRole;
  imageUrl: string;
  status: IngestionJobStatus;
  error: string | null;
}

interface IconsImageIngestionRun {
  id: string;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  status: IconsImportImageRunStatus;
  jobs: IconsImageIngestionJob[];
  isProcessing: boolean;
}

export interface IconsImageIngestionJobInput {
  rowKey: string;
  rowNumber: number;
  name: string;
  teamId: string;
  teamName: string;
  role: TeamRole;
  imageUrl: string;
}

const DEFAULT_PROCESS_BATCH_SIZE = 8;
const DEFAULT_PROCESS_CONCURRENCY = 3;
const RUN_RETENTION_MS = 60 * 60 * 1000;

const globals = globalThis as typeof globalThis & {
  __iconsImageIngestionRuns?: Map<string, IconsImageIngestionRun>;
};

const runs =
  globals.__iconsImageIngestionRuns ??
  new Map<string, IconsImageIngestionRun>();
if (!globals.__iconsImageIngestionRuns) {
  globals.__iconsImageIngestionRuns = runs;
}

function pruneRuns(): void {
  const now = Date.now();
  for (const [runId, run] of runs.entries()) {
    if (!run.finishedAt) continue;
    if (now - run.finishedAt > RUN_RETENTION_MS) {
      runs.delete(runId);
    }
  }
}

function toPositiveInt(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function deriveRunStatus(
  run: IconsImageIngestionRun,
): IconsImportImageRunStatus {
  const totalJobs = run.jobs.length;
  if (totalJobs === 0) return "COMPLETED";

  let pendingJobs = 0;
  let inProgressJobs = 0;
  let completedJobs = 0;
  let failedJobs = 0;

  for (const job of run.jobs) {
    if (job.status === "PENDING") pendingJobs += 1;
    if (job.status === "IN_PROGRESS") inProgressJobs += 1;
    if (job.status === "COMPLETED") completedJobs += 1;
    if (job.status === "FAILED") failedJobs += 1;
  }

  if (pendingJobs === 0 && inProgressJobs === 0) {
    return failedJobs > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
  }

  if (completedJobs > 0 || failedJobs > 0 || inProgressJobs > 0) {
    return "PROCESSING";
  }

  return "PENDING";
}

function toRoleLabel(role: TeamRole): string {
  return role === "CO_OWNER" ? "CO-OWNER" : role;
}

function buildFallbackName(teamName: string, role: TeamRole): string {
  const normalizedTeamName = teamName.trim() || "Unknown team";
  return `${normalizedTeamName} ${toRoleLabel(role)}`;
}

function mapFailedRows(
  run: IconsImageIngestionRun,
): IconsImportImageIngestionFailureRow[] {
  return run.jobs
    .filter((job) => job.status === "FAILED")
    .sort((a, b) => a.rowNumber - b.rowNumber)
    .map((job) => ({
      rowKey: job.rowKey,
      rowNumber: job.rowNumber,
      name:
        (job.name ?? "").trim() || buildFallbackName(job.teamName, job.role),
      teamName: job.teamName,
      role: job.role,
      imageUrl: job.imageUrl,
      error: job.error ?? "Unknown ingestion error",
    }));
}

function toProgress(
  run: IconsImageIngestionRun,
): IconsImportImageIngestionProgress {
  let pendingJobs = 0;
  let inProgressJobs = 0;
  let completedJobs = 0;
  let failedJobs = 0;

  for (const job of run.jobs) {
    if (job.status === "PENDING") pendingJobs += 1;
    if (job.status === "IN_PROGRESS") inProgressJobs += 1;
    if (job.status === "COMPLETED") completedJobs += 1;
    if (job.status === "FAILED") failedJobs += 1;
  }

  const totalJobs = run.jobs.length;
  const percent =
    totalJobs === 0
      ? 100
      : Math.round(((completedJobs + failedJobs) / totalJobs) * 100);

  return {
    runId: run.id,
    status: run.status,
    totalJobs,
    completedJobs,
    failedJobs,
    pendingJobs,
    inProgressJobs,
    percent: Math.max(0, Math.min(100, percent)),
    failedRows: mapFailedRows(run),
  };
}

function syncRunState(run: IconsImageIngestionRun): void {
  run.status = deriveRunStatus(run);
  run.updatedAt = Date.now();

  if (
    run.startedAt === null &&
    run.jobs.some((job) => job.status !== "PENDING")
  ) {
    run.startedAt = run.updatedAt;
  }

  if (run.status === "COMPLETED" || run.status === "COMPLETED_WITH_ERRORS") {
    run.finishedAt = run.finishedAt ?? run.updatedAt;
  } else {
    run.finishedAt = null;
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
    while (index < values.length) {
      const current = index;
      index += 1;
      await worker(values[current]);
    }
  });

  await Promise.all(runners);
}

async function processJob(
  supabase: SupabaseAdminClient,
  run: IconsImageIngestionRun,
  job: IconsImageIngestionJob,
): Promise<void> {
  try {
    const uploadResult = await uploadRoleImagesFromUrls(supabase, [
      {
        rowKey: job.rowKey,
        sessionId: run.sessionId,
        teamId: job.teamId,
        role: job.role,
        imageUrl: job.imageUrl,
      },
    ]);

    const failed = uploadResult.failures[0];
    if (failed) {
      job.status = "FAILED";
      job.error = failed.error;
      return;
    }

    const publicUrl = uploadResult.publicUrlByRowKey.get(job.rowKey);
    if (!publicUrl) {
      job.status = "FAILED";
      job.error = "Image upload completed without a public URL";
      return;
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("TeamRoleProfile")
      .update({ imageUrl: publicUrl, updatedAt: nowIso })
      .eq("teamId", job.teamId)
      .eq("role", job.role);

    if (updateError) {
      job.status = "FAILED";
      job.error = `Failed to persist uploaded image URL: ${updateError.message}`;
      return;
    }

    job.status = "COMPLETED";
    job.error = null;
  } catch (error) {
    job.status = "FAILED";
    job.error =
      error instanceof Error ? error.message : "Unknown ingestion error";
  }
}

export function enqueueIconsImageIngestionRun(
  sessionId: string,
  jobsInput: IconsImageIngestionJobInput[],
): IconsImportImageIngestionProgress {
  pruneRuns();

  const filtered = jobsInput.filter((job) => job.imageUrl.trim().length > 0);
  if (filtered.length === 0) {
    return {
      runId: "none",
      status: "COMPLETED",
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      pendingJobs: 0,
      inProgressJobs: 0,
      percent: 100,
      failedRows: [],
    };
  }

  const now = Date.now();
  const run: IconsImageIngestionRun = {
    id: crypto.randomUUID(),
    sessionId,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    status: "PENDING",
    jobs: filtered.map((job) => ({
      id: crypto.randomUUID(),
      rowKey: job.rowKey,
      rowNumber: job.rowNumber,
      name: job.name.trim() || buildFallbackName(job.teamName, job.role),
      teamId: job.teamId,
      teamName: job.teamName,
      role: job.role,
      imageUrl: job.imageUrl,
      status: "PENDING",
      error: null,
    })),
    isProcessing: false,
  };

  syncRunState(run);
  runs.set(run.id, run);
  return toProgress(run);
}

export function syncIconsImageIngestionRun(
  runId: string,
): IconsImportImageIngestionProgress | null {
  pruneRuns();
  const run = runs.get(runId);
  if (!run) return null;
  syncRunState(run);
  return toProgress(run);
}

export async function processIconsImageIngestionRun(
  supabase: SupabaseAdminClient,
  runId: string,
  options?: { maxJobs?: number; concurrency?: number },
): Promise<IconsImportImageIngestionProgress | null> {
  pruneRuns();
  const run = runs.get(runId);
  if (!run) return null;

  if (run.status === "COMPLETED" || run.status === "COMPLETED_WITH_ERRORS") {
    return toProgress(run);
  }

  if (run.isProcessing) {
    syncRunState(run);
    return toProgress(run);
  }

  const maxJobs = toPositiveInt(options?.maxJobs, DEFAULT_PROCESS_BATCH_SIZE);
  const concurrency = toPositiveInt(
    options?.concurrency,
    DEFAULT_PROCESS_CONCURRENCY,
  );

  const toProcess = run.jobs
    .filter((job) => job.status === "PENDING")
    .slice(0, maxJobs);

  if (toProcess.length === 0) {
    syncRunState(run);
    return toProgress(run);
  }

  for (const job of toProcess) {
    job.status = "IN_PROGRESS";
    job.error = null;
  }

  run.isProcessing = true;
  syncRunState(run);

  try {
    await mapWithConcurrency(toProcess, concurrency, async (job) => {
      await processJob(supabase, run, job);
    });
  } finally {
    run.isProcessing = false;
    syncRunState(run);
  }

  return toProgress(run);
}
