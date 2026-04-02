"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Database, Loader2, Search, Trash2 } from "lucide-react";
import Papa from "papaparse";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  buildHeaderLookup,
  normalizeRow,
  toCommitRow,
} from "@/features/icons-import/normalize";
import type {
  IconsImportCheckResult,
  IconsImportCommitResult,
  IconsImportDraftRow,
  IconsImportImageIngestionProgress,
  IconsImportMode,
  RawCsvRow,
} from "@/features/icons-import/types";
import { validateAllRows } from "@/features/icons-import/validate";
import { IconsCsvUploadBox } from "./IconsCsvUploadBox";

function reorderRows(rows: IconsImportDraftRow[]): IconsImportDraftRow[] {
  return rows.map((row, index) => ({
    ...row,
    importOrder: index,
    _key: `row-${index}`,
  }));
}

function formatRoleLabel(role: string): string {
  return role.replaceAll("_", "-");
}

export function IconsImportPanel() {
  const qc = useQueryClient();

  const [draftRows, setDraftRows] = useState<IconsImportDraftRow[]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [missingHeaders, setMissingHeaders] = useState<string[]>([]);
  const [checkResult, setCheckResult] = useState<IconsImportCheckResult | null>(
    null,
  );
  const [result, setResult] = useState<IconsImportCommitResult | null>(null);
  const [mode, setMode] = useState<IconsImportMode>("APPEND");
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageIngestion, setImageIngestion] =
    useState<IconsImportImageIngestionProgress | null>(null);

  const hasChanges = draftRows.length > 0;

  const hasDraftErrors = useMemo(
    () => draftRows.some((row) => row.hasErrors),
    [draftRows],
  );

  const checkRowsByKey = useMemo(() => {
    if (!checkResult) return {};

    return checkResult.rows.reduce<
      Record<string, (typeof checkResult.rows)[number]>
    >((acc, row) => {
      acc[row.rowKey] = row;
      return acc;
    }, {});
  }, [checkResult]);

  const canCommit =
    hasChanges &&
    !isChecking &&
    !isSubmitting &&
    !!checkResult &&
    checkResult.summary.missingHeaders.length === 0 &&
    checkResult.summary.blockingRows === 0 &&
    !hasDraftErrors;

  const ingestionIsTerminal =
    imageIngestion?.status === "COMPLETED" ||
    imageIngestion?.status === "COMPLETED_WITH_ERRORS";

  useEffect(() => {
    if (!imageIngestion) return;
    if (imageIngestion.runId === "none") return;
    if (ingestionIsTerminal) return;

    const runId = imageIngestion.runId;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/admin/icons-import/ingestion/${runId}?process=1`,
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          return;
        }

        const nextProgress = data.data as IconsImportImageIngestionProgress;
        if (cancelled) return;

        setImageIngestion(nextProgress);

        if (
          nextProgress.status === "COMPLETED" ||
          nextProgress.status === "COMPLETED_WITH_ERRORS"
        ) {
          qc.invalidateQueries({ queryKey: ["admin-teams"] });
          qc.invalidateQueries({ queryKey: ["teams"] });
          qc.invalidateQueries({ queryKey: ["team"] });
          qc.invalidateQueries({ queryKey: ["auctionStats"] });
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
  }, [imageIngestion, ingestionIsTerminal, qc]);

  const resetCheckState = () => {
    setCheckResult(null);
  };

  const handleFileUpload = (file: File) => {
    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const { canonicalToRaw, missingHeaders: headerErrors } =
          buildHeaderLookup(headers);

        const canonicalHeaders = Object.keys(canonicalToRaw).filter(
          (header) => canonicalToRaw[header as keyof typeof canonicalToRaw],
        );

        const normalized = results.data.map((row, index) =>
          normalizeRow(row, index, canonicalToRaw),
        );
        const validated = validateAllRows(normalized);

        setDraftRows(validated);
        setParsedHeaders(canonicalHeaders);
        setMissingHeaders(headerErrors);
        setResult(null);
        setImageIngestion(null);
        resetCheckState();

        toast.success(
          `Parsed ${validated.length} row${validated.length === 1 ? "" : "s"}`,
        );

        if (headerErrors.length > 0) {
          toast.warning(
            `Missing required headers: ${headerErrors.join(", ")}.`,
          );
        }
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`);
      },
    });
  };

  const handleCheckWithDatabase = async () => {
    if (!hasChanges) {
      toast.error("Upload a CSV first");
      return;
    }

    setIsChecking(true);
    try {
      const res = await fetch("/api/admin/icons-import/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          headers: parsedHeaders,
          rows: draftRows.map(toCommitRow),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to check icons import");
      }

      const nextCheck = data.data as IconsImportCheckResult;
      setCheckResult(nextCheck);

      if (nextCheck.summary.blockingRows > 0) {
        toast.warning(
          `Check complete with ${nextCheck.summary.blockingRows} blocking row${nextCheck.summary.blockingRows === 1 ? "" : "s"}.`,
        );
      } else {
        toast.success("Check complete. Ready to commit.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Check operation failed",
      );
    } finally {
      setIsChecking(false);
    }
  };

  const handleCommit = async () => {
    if (!checkResult) {
      toast.error("Run Check with Database before committing");
      return;
    }

    if (!canCommit) {
      toast.error("Resolve all blocking issues before committing");
      return;
    }

    const confirmationText =
      mode === "REPLACE"
        ? "This will REPLACE existing team role profiles for active session teams and apply team POINTS from this CSV. Continue?"
        : "This will APPEND role profiles and apply team POINTS for teams present in this CSV. Continue?";

    if (!confirm(confirmationText)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/icons-import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          checkId: checkResult.checkId,
          checkFingerprint: checkResult.checkFingerprint,
          rows: draftRows.map(toCommitRow),
          resolutions: [],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to commit icons import");
      }

      const commitResult = data.data as IconsImportCommitResult;
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
      setMissingHeaders([]);
      resetCheckState();

      if (commitResult.imageIngestion?.runId === "none") {
        toast.success("Icons import committed successfully!");
      } else {
        toast.success(
          "Icons import committed. Image ingestion is in progress.",
        );
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-teams"] }),
        qc.invalidateQueries({ queryKey: ["teams"] }),
        qc.invalidateQueries({ queryKey: ["team"] }),
        qc.invalidateQueries({ queryKey: ["auctionStats"] }),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Commit operation failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!confirm("Discard imported icons CSV data?")) {
      return;
    }

    setDraftRows([]);
    setParsedHeaders([]);
    setMissingHeaders([]);
    setResult(null);
    setImageIngestion(null);
    resetCheckState();
  };

  const handleRemoveRow = (rowKey: string) => {
    setDraftRows((prev) => {
      const filtered = prev.filter((row) => row._key !== rowKey);
      return reorderRows(validateAllRows(filtered));
    });
    resetCheckState();
  };

  return (
    <div className="flex flex-col gap-6">
      {!hasChanges && !result && (
        <IconsCsvUploadBox
          onFile={handleFileUpload}
          isDisabled={isChecking || isSubmitting}
        />
      )}

      {result && (
        <div className="rounded-xl border border-accent-green/30 bg-accent-green/10 px-4 py-3 text-sm text-accent-green flex flex-col gap-1">
          <p className="font-semibold">Icons import completed.</p>
          <p>
            {result.upsertedCount} role profiles updated across{" "}
            {result.teamsTouched} teams.
          </p>
          <p>{result.teamPointsUpdatedCount} teams had points updated.</p>
          {result.mode === "REPLACE" && (
            <p>
              {result.replacedProfilesCount} existing role profiles were removed
              before import.
            </p>
          )}
        </div>
      )}

      {imageIngestion && (
        <div className="rounded-xl border border-accent-blue/30 bg-accent-blue/5 px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-accent-blue">
              Role icon ingestion
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
              No image URLs detected. Import reached 100% immediately.
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
                      <th className="px-2 py-1.5 text-left">Name</th>
                      <th className="px-2 py-1.5 text-left">Team</th>
                      <th className="px-2 py-1.5 text-left">Role</th>
                      <th className="px-2 py-1.5 text-left">Image URL</th>
                      <th className="px-2 py-1.5 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imageIngestion.failedRows.map((failedRow) => {
                      const roleLabel = formatRoleLabel(failedRow.role);
                      const displayName =
                        (failedRow.name ?? "").trim() ||
                        `${failedRow.teamName} ${roleLabel}`;

                      return (
                        <tr
                          key={`${failedRow.rowKey}-${failedRow.rowNumber}`}
                          className="border-b border-slate-800/40 align-top"
                        >
                          <td className="px-2 py-1.5 text-slate-300">
                            {failedRow.rowNumber}
                          </td>
                          <td className="px-2 py-1.5 text-slate-200 whitespace-nowrap">
                            {displayName}
                          </td>
                          <td className="px-2 py-1.5 text-slate-200">
                            {failedRow.teamName}
                          </td>
                          <td className="px-2 py-1.5 text-slate-200">
                            {roleLabel}
                          </td>
                          <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">
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
                      );
                    })}
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
              Icons Preview ({draftRows.length} rows)
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

          {(missingHeaders.length > 0 || hasDraftErrors) && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">
              {missingHeaders.length > 0 && (
                <p>Missing required headers: {missingHeaders.join(", ")}.</p>
              )}
              {hasDraftErrors && (
                <p>
                  Some rows have local validation errors. Fix CSV and re-upload
                  or remove invalid rows.
                </p>
              )}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-190 text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-widest font-mono border-b border-slate-800/80 bg-pitch-950/50">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Team</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Image URL</th>
                  <th className="px-3 py-2 text-left">Points</th>
                  <th className="px-3 py-2 text-left">Issues</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {draftRows.map((row) => {
                  const checkRow = checkRowsByKey[row._key];
                  const issues = checkRow?.issues ?? [];

                  return (
                    <tr
                      key={row._key}
                      className="border-b border-slate-800/40 align-top"
                    >
                      <td className="px-3 py-2 text-slate-400">
                        {row.importOrder + 1}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {row.name || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {row.teamName || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {row.status || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                        {row.imageUrl ? (
                          <a
                            href={row.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-accent-blue underline underline-offset-2"
                          >
                            {row.imageUrl}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {row.points || "-"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.hasErrors && (
                          <div className="text-red-300">
                            {Object.values(row.errors).join(" | ")}
                          </div>
                        )}
                        {!row.hasErrors && issues.length === 0 && (
                          <span className="text-accent-green">No issues</span>
                        )}
                        {issues.length > 0 && (
                          <div className="text-red-300 flex flex-col gap-1">
                            {issues.map((issue) => (
                              <span
                                key={`${row._key}-${issue.code}-${issue.message}`}
                              >
                                {issue.message}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-slate-700 text-slate-300 hover:text-red-300 hover:border-red-500/50 transition-colors"
                          onClick={() => handleRemoveRow(row._key)}
                          disabled={isChecking || isSubmitting}
                        >
                          <Trash2 className="size-3" />
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500 transition-colors"
              onClick={handleCancel}
              disabled={isChecking || isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-accent-blue/40 text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleCheckWithDatabase}
              disabled={isChecking || isSubmitting}
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
              Run Check with Database before committing. Commit is disabled
              until check passes.
            </div>
          )}

          {checkResult && (
            <div
              className={`rounded-xl px-4 py-3 text-sm border ${
                checkResult.summary.blockingRows > 0
                  ? "border-red-500/30 bg-red-950/20 text-red-300"
                  : "border-accent-green/30 bg-accent-green/10 text-accent-green"
              }`}
            >
              <p className="font-semibold">
                Check summary: {checkResult.summary.validRows}/
                {checkResult.summary.totalRows} valid rows.
              </p>
              <p className="mt-1 text-xs">
                Blocking rows: {checkResult.summary.blockingRows} | Duplicate
                team-role rows: {checkResult.summary.duplicateTeamRoleRows} |
                Unknown teams: {checkResult.summary.unknownTeamRows} | Invalid
                points rows: {checkResult.summary.invalidPointsRows} | Point
                conflicts: {checkResult.summary.teamPointsConflictRows}
              </p>
            </div>
          )}

          {checkResult?.summary.blockingRows ? (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5" />
              <p>
                Commit is blocked until all blocking rows are removed or fixed.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
