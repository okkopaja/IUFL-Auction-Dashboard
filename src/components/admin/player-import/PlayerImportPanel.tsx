"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Database, Loader2, Search } from "lucide-react";
import Papa from "papaparse";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  normalizeRow,
  reorderRows,
  toCommitRow,
} from "@/features/player-import/normalize";
import type {
  ImportCheckPayload,
  ImportCheckResult,
  ImportCheckRowResult,
  ImportCommitPayload,
  ImportCommitResult,
  ImportDraftRow,
  ImportImageIngestionProgress,
  ImportMode,
  ImportResolutionAction,
  RawCsvRow,
} from "@/features/player-import/types";
import {
  checkHeaders,
  removeCsvDuplicates,
  validateAllRows,
} from "@/features/player-import/validate";
import { CsvUploadBox } from "./CsvUploadBox";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { ImportSummaryCard } from "./ImportSummaryCard";

export function PlayerImportPanel() {
  const qc = useQueryClient();

  const [draftRows, setDraftRows] = useState<ImportDraftRow[]>([]);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [checkResult, setCheckResult] = useState<ImportCheckResult | null>(
    null,
  );
  const [resolutions, setResolutions] = useState<
    Record<string, ImportResolutionAction>
  >({});
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [mode, setMode] = useState<ImportMode>("APPEND");
  const [removeDuplicatesOnUpload, setRemoveDuplicatesOnUpload] =
    useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageIngestion, setImageIngestion] =
    useState<ImportImageIngestionProgress | null>(null);

  const hasChanges = draftRows.length > 0;
  const hasDraftErrors = useMemo(
    () => draftRows.some((row) => row.hasErrors),
    [draftRows],
  );

  const checkRowsByKey = useMemo(() => {
    if (!checkResult) return {};
    return checkResult.rows.reduce<Record<string, ImportCheckRowResult>>(
      (acc, row) => {
        acc[row.rowKey] = row;
        return acc;
      },
      {},
    );
  }, [checkResult]);

  const unresolvedConflicts = useMemo(() => {
    if (!checkResult) return Number.POSITIVE_INFINITY;

    let unresolved = checkResult.summary.missingHeaders.length;
    for (const rowCheck of checkResult.rows) {
      if (!rowCheck.resolutionRequired) continue;
      const action = resolutions[rowCheck.rowKey];
      if (!action || !rowCheck.allowedActions.includes(action)) {
        unresolved += 1;
      }
    }

    return unresolved;
  }, [checkResult, resolutions]);

  const hasActiveErrors = useMemo(
    () =>
      draftRows.some(
        (row) => row.hasErrors && resolutions[row._key] !== "SKIP",
      ),
    [draftRows, resolutions],
  );

  const hasIconPlayersInPlayerbase =
    (checkResult?.existingIconPlayersInBaseCount ?? 0) > 0;

  const canCommit =
    hasChanges &&
    !isSubmitting &&
    !isChecking &&
    !!checkResult &&
    unresolvedConflicts === 0 &&
    !hasActiveErrors &&
    !hasIconPlayersInPlayerbase;

  const ingestionIsTerminal =
    imageIngestion?.status === "COMPLETED" ||
    imageIngestion?.status === "COMPLETED_WITH_ERRORS";
  const imageIngestionRunId = imageIngestion?.runId;

  useEffect(() => {
    if (!imageIngestionRunId) return;
    if (imageIngestionRunId === "none") return;
    if (ingestionIsTerminal) return;

    const runId = imageIngestionRunId;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/admin/player-import/ingestion/${runId}?process=1`,
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          return;
        }

        const nextProgress = data.data as ImportImageIngestionProgress;
        if (cancelled) return;

        setImageIngestion(nextProgress);

        if (
          nextProgress.status === "COMPLETED" ||
          nextProgress.status === "COMPLETED_WITH_ERRORS"
        ) {
          qc.invalidateQueries({ queryKey: ["players"] });
          qc.invalidateQueries({ queryKey: ["currentPlayer"] });
        }
      } catch {
        // Progress polling should not block the UI.
      }
    };

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [imageIngestionRunId, ingestionIsTerminal, qc]);

  const resetCheckState = () => {
    setCheckResult(null);
    setResolutions({});
  };

  const handleFileUpload = (file: File) => {
    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const missing = checkHeaders(headers);

        setParsedHeaders(headers);

        const normalized = results.data.map((row, i) => normalizeRow(row, i));
        const { rows: preparedRows, removedCount } = removeDuplicatesOnUpload
          ? removeCsvDuplicates(normalized)
          : { rows: normalized, removedCount: 0 };
        const validated = validateAllRows(preparedRows);

        setDraftRows(validated);
        setResult(null);
        setImageIngestion(null);
        resetCheckState();
        toast.success(`Parsed ${validated.length} rows`);

        if (removedCount > 0) {
          toast.info(
            `Removed ${removedCount} duplicate row${removedCount === 1 ? "" : "s"} (same Name + Whatsapp Number).`,
          );
        }

        if (missing.length > 0) {
          toast.warning(
            `Missing required headers: ${missing.join(", ")}. Run Check with Database before commit.`,
          );
        }
      },
      error: (err) => {
        toast.error(`Failed to parse CSV: ${err.message}`);
      },
    });
  };

  const handleEditCell = (
    key: string,
    field: keyof ImportDraftRow,
    value: string,
  ) => {
    setDraftRows((prev) => {
      const updated = prev.map((row) =>
        row._key === key ? { ...row, [field]: value } : row,
      );
      return validateAllRows(updated);
    });
    resetCheckState();
  };

  const handleRemoveRow = (key: string) => {
    setDraftRows((prev) => {
      const filtered = prev.filter((r) => r._key !== key);
      const reordered = reorderRows(filtered);
      return validateAllRows(reordered);
    });
    resetCheckState();
  };

  const handleCheckWithDatabase = async () => {
    if (!hasChanges) {
      toast.error("Upload a CSV first");
      return;
    }

    setIsChecking(true);
    try {
      const payload: ImportCheckPayload = {
        mode,
        headers: parsedHeaders,
        rows: draftRows.map(toCommitRow),
      };

      const res = await fetch("/api/admin/player-import/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to check import");
      }

      const nextCheck = data.data as ImportCheckResult;
      setCheckResult(nextCheck);

      const nextResolutions: Record<string, ImportResolutionAction> = {};
      for (const rowCheck of nextCheck.rows) {
        if (rowCheck.resolutionRequired) {
          nextResolutions[rowCheck.rowKey] = rowCheck.suggestedAction;
        }
      }
      setResolutions(nextResolutions);

      if (nextCheck.summary.missingHeaders.length > 0) {
        toast.error("Required headers are missing. Fix CSV and re-upload.");
      } else if (nextCheck.summary.iconRows > 0) {
        toast.error(
          `Check failed: ${nextCheck.summary.iconRows} row${nextCheck.summary.iconRows === 1 ? "" : "s"} match IUFL icon names. Remove those rows from CSV.`,
        );
      } else if (nextCheck.summary.blockingRows > 0) {
        toast.warning(
          `Check complete with ${nextCheck.summary.blockingRows} blocking rows. Resolve them before committing.`,
        );
      } else {
        toast.success("Check complete. Ready to commit.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Check failed");
    } finally {
      setIsChecking(false);
    }
  };

  const handleResolutionChange = (
    rowKey: string,
    action: ImportResolutionAction,
  ) => {
    setResolutions((prev) => ({ ...prev, [rowKey]: action }));
  };

  const handleCommit = async () => {
    if (!checkResult) {
      toast.error("Run Check with Database before commit");
      return;
    }

    if (unresolvedConflicts > 0) {
      toast.error("Resolve all check conflicts before committing");
      return;
    }

    if (hasActiveErrors) {
      toast.error("Fix row errors or mark those rows as SKIP");
      return;
    }

    if (hasIconPlayersInPlayerbase) {
      toast.error(
        "Remove IUFL Icons from Playerbase before committing player import",
      );
      return;
    }

    const confirmationText =
      mode === "REPLACE"
        ? "This will REPLACE all players and DELETE all auction transactions for the active session. Are you sure?"
        : "This will APPEND players to the current session and keep existing auction history. Continue?";

    if (!confirm(confirmationText)) return;

    setIsSubmitting(true);
    try {
      const payload: ImportCommitPayload = {
        mode,
        checkId: checkResult.checkId,
        checkFingerprint: checkResult.checkFingerprint,
        rows: draftRows.map(toCommitRow),
        resolutions: Object.entries(resolutions).map(([rowKey, action]) => ({
          rowKey,
          action,
        })),
      };

      const res = await fetch("/api/admin/player-import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to commit import");
      }

      const commitResult = data.data as ImportCommitResult;
      setResult(commitResult);
      setImageIngestion(
        commitResult.imageIngestion ?? {
          runId: "none",
          status: "COMPLETED",
          totalJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          pendingJobs: 0,
          inProgressJobs: 0,
          percent: 100,
          failedRows: [],
        },
      );
      setDraftRows([]);
      setParsedHeaders([]);
      resetCheckState();
      toast.success("Players imported successfully!");

      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["currentPlayer"] });
      qc.invalidateQueries({ queryKey: ["auctionLog"] });
      qc.invalidateQueries({ queryKey: ["auctionStats"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (confirm("Discard all imported data?")) {
      setDraftRows([]);
      setParsedHeaders([]);
      setResult(null);
      setImageIngestion(null);
      resetCheckState();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!hasChanges && !result && (
        <CsvUploadBox
          onFile={handleFileUpload}
          isDisabled={isSubmitting || isChecking}
          removeDuplicatesOnUpload={removeDuplicatesOnUpload}
          onRemoveDuplicatesOnUploadChange={setRemoveDuplicatesOnUpload}
        />
      )}

      {result && <ImportSummaryCard result={result} />}

      {imageIngestion && (
        <div className="rounded-xl border border-accent-blue/30 bg-accent-blue/5 px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-accent-blue">
              Player image ingestion
            </p>
            <p className="text-xs font-mono text-slate-300">
              {imageIngestion.percent}%
            </p>
          </div>

          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                imageIngestion.status === "COMPLETED_WITH_ERRORS"
                  ? "bg-amber-400"
                  : "bg-accent-blue"
              }`}
              style={{ width: `${imageIngestion.percent}%` }}
            />
          </div>

          <p className="text-xs text-slate-400">
            {imageIngestion.completedJobs} completed,{" "}
            {imageIngestion.failedJobs} failed, {imageIngestion.pendingJobs}{" "}
            pending, {imageIngestion.inProgressJobs} in progress.
          </p>

          {imageIngestion.runId === "none" && (
            <p className="text-xs text-accent-green">
              No Drive image URLs detected. Import reached 100% immediately.
            </p>
          )}

          {ingestionIsTerminal && imageIngestion.runId !== "none" && (
            <p
              className={`text-xs ${
                imageIngestion.status === "COMPLETED_WITH_ERRORS"
                  ? "text-amber-300"
                  : "text-accent-green"
              }`}
            >
              {imageIngestion.status === "COMPLETED_WITH_ERRORS"
                ? "Image ingestion finished with some failures."
                : "Image ingestion completed successfully."}
            </p>
          )}

          {ingestionIsTerminal && imageIngestion.failedRows.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 flex flex-col gap-2">
              <p className="text-xs font-semibold text-amber-300">
                Failed image ingestion rows ({imageIngestion.failedRows.length})
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-190 text-xs">
                  <thead>
                    <tr className="text-slate-400 uppercase tracking-wide border-b border-slate-700/70">
                      <th className="px-2 py-1.5 text-left">Row</th>
                      <th className="px-2 py-1.5 text-left">Player</th>
                      <th className="px-2 py-1.5 text-left">Image URL</th>
                      <th className="px-2 py-1.5 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imageIngestion.failedRows.map((failedRow) => (
                      <tr
                        key={`${failedRow.playerId}-${failedRow.rowNumber}-${failedRow.imageUrl}`}
                        className="border-b border-slate-800/40 align-top"
                      >
                        <td className="px-2 py-1.5 text-slate-300">
                          {failedRow.rowNumber}
                        </td>
                        <td className="px-2 py-1.5 text-slate-200">
                          {failedRow.playerName}
                        </td>
                        <td className="px-2 py-1.5 text-slate-400 break-all">
                          <a
                            href={failedRow.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-accent-blue underline underline-offset-2"
                          >
                            {failedRow.imageUrl}
                          </a>
                        </td>
                        <td className="px-2 py-1.5 text-amber-300">
                          {failedRow.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {hasChanges && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <Database className="size-5 text-accent-gold" />
              Preview Data ({draftRows.length} players)
            </h3>
            <div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900/60 p-1">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  mode === "APPEND"
                    ? "bg-accent-green/20 text-accent-green"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                onClick={() => {
                  setMode("APPEND");
                  resetCheckState();
                }}
                disabled={isChecking || isSubmitting}
              >
                Append
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  mode === "REPLACE"
                    ? "bg-red-500/20 text-red-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                onClick={() => {
                  setMode("REPLACE");
                  resetCheckState();
                }}
                disabled={isChecking || isSubmitting}
              >
                Replace
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500 transition-colors"
              onClick={handleCancel}
              disabled={isSubmitting || isChecking}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-accent-blue/40 text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleCheckWithDatabase}
              disabled={isSubmitting || isChecking}
            >
              {isChecking ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Search className="size-4" />
                  Check with Database
                </>
              )}
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg text-pitch-950 bg-accent-gold hover:bg-accent-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleCommit}
              disabled={!canCommit}
            >
              {isSubmitting ? "Importing..." : "Commit Data"}
            </button>
          </div>

          {!checkResult && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-amber-300 text-sm">
              Run Check with Database before committing. Commit is blocked until
              check passes and conflicts are resolved.
            </div>
          )}

          {checkResult && (
            <div
              className={`rounded-xl px-4 py-3 text-sm border ${
                unresolvedConflicts > 0
                  ? "border-red-500/30 bg-red-950/20 text-red-300"
                  : "border-accent-green/30 bg-accent-green/10 text-accent-green"
              }`}
            >
              <p className="font-semibold">
                Check complete: {checkResult.summary.blockingRows} blocking,{" "}
                {checkResult.summary.warningRows} warnings.
              </p>
              {checkResult.summary.iconRows > 0 && (
                <p className="mt-1 text-xs">
                  {checkResult.summary.iconRows} row
                  {checkResult.summary.iconRows === 1 ? "" : "s"} match IUFL
                  icon names and must be removed from this import.
                </p>
              )}
              {(checkResult.existingIconPlayersInBaseCount ?? 0) > 0 && (
                <p className="mt-1 text-xs">
                  Active playerbase still contains{" "}
                  {checkResult.existingIconPlayersInBaseCount} IUFL icon player
                  {checkResult.existingIconPlayersInBaseCount === 1 ? "" : "s"}.
                  Use Remove IUFL Icons from Playerbase before commit.
                </p>
              )}
              {checkResult.summary.missingHeaders.length > 0 && (
                <p className="mt-1 text-xs">
                  Missing headers:{" "}
                  {checkResult.summary.missingHeaders.join(", ")}
                </p>
              )}
              <p className="mt-1 text-xs">
                {unresolvedConflicts > 0
                  ? `${unresolvedConflicts} conflict items still need resolution.`
                  : "All blocking conflicts are resolved. Ready to commit."}
              </p>
            </div>
          )}

          {hasDraftErrors && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 flex items-center gap-3 text-red-400 text-sm">
              <AlertTriangle className="size-4 shrink-0" />
              Validation errors exist in the preview rows. Either fix those rows
              or mark them as SKIP during conflict resolution.
            </div>
          )}

          <ImportPreviewTable
            rows={draftRows}
            onEditCell={handleEditCell}
            onRemoveRow={handleRemoveRow}
            checkRowsByKey={checkRowsByKey}
            resolutions={resolutions}
            onResolutionChange={handleResolutionChange}
          />
        </div>
      )}
    </div>
  );
}
