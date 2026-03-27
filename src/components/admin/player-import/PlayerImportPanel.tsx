"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Database } from "lucide-react";
import Papa from "papaparse";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { normalizeRow, reorderRows } from "@/features/player-import/normalize";
import type {
  ImportCommitPayload,
  ImportCommitResult,
  ImportDraftRow,
  RawCsvRow,
} from "@/features/player-import/types";
import {
  checkHeaders,
  validateAllRows,
} from "@/features/player-import/validate";
import { CsvUploadBox } from "./CsvUploadBox";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { ImportSummaryCard } from "./ImportSummaryCard";

export function PlayerImportPanel() {
  const qc = useQueryClient();

  const [draftRows, setDraftRows] = useState<ImportDraftRow[]>([]);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasChanges = draftRows.length > 0;
  const hasErrors = useMemo(
    () => draftRows.some((r) => r.hasErrors),
    [draftRows],
  );

  const handleFileUpload = (file: File) => {
    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const missing = checkHeaders(headers);

        if (missing.length > 0) {
          toast.error(`Missing required headers: ${missing.join(", ")}`);
          return;
        }

        const normalized = results.data.map((row, i) => normalizeRow(row, i));
        const validated = validateAllRows(normalized);

        setDraftRows(validated);
        setResult(null);
        toast.success(`Parsed ${validated.length} rows`);
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
  };

  const handleRemoveRow = (key: string) => {
    setDraftRows((prev) => {
      const filtered = prev.filter((r) => r._key !== key);
      const reordered = reorderRows(filtered);
      return validateAllRows(reordered);
    });
  };

  const handleCommit = async () => {
    if (hasErrors) {
      toast.error("Cannot commit while there are validation errors");
      return;
    }

    if (
      !confirm(
        "This will REPLACE all players and DELETE all auction transactions for the active session. Are you sure?",
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ImportCommitPayload = {
        rows: draftRows.map((r) => ({
          name: r.name,
          year: r.year,
          whatsappNumber: r.whatsappNumber,
          stream: r.stream,
          position1: r.position1,
          position2: r.position2,
          importOrder: r.importOrder,
        })),
      };

      const res = await fetch("/api/admin/player-import/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to commit import");
      }

      setResult(data.data);
      setDraftRows([]);
      toast.success("Players imported successfully!");

      // Invalidate queries so the app refreshes
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
      setResult(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!hasChanges && !result && (
        <CsvUploadBox onFile={handleFileUpload} isDisabled={isSubmitting} />
      )}

      {result && <ImportSummaryCard result={result} />}

      {hasChanges && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <Database className="size-5 text-accent-gold" />
              Preview Data ({draftRows.length} players)
            </h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500 transition-colors"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg text-pitch-950 bg-accent-gold hover:bg-accent-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCommit}
                disabled={isSubmitting || hasErrors}
              >
                {isSubmitting ? "Importing..." : "Commit Data"}
              </button>
            </div>
          </div>

          {hasErrors && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 flex items-center gap-3 text-red-400 text-sm">
              <AlertTriangle className="size-4 shrink-0" />
              There are validation errors in the preview data. Please fix them
              before committing.
            </div>
          )}

          <ImportPreviewTable
            rows={draftRows}
            onEditCell={handleEditCell}
            onRemoveRow={handleRemoveRow}
          />
        </div>
      )}
    </div>
  );
}
