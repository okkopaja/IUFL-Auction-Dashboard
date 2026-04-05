"use client";

import { Eye, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TeamWiseExportData } from "@/features/player-export/teamWiseExport";
import { TeamWiseExportPreviewDialog } from "./TeamWiseExportPreviewDialog";

function downloadTeamWiseCsv(data: TeamWiseExportData): void {
  const csvText = Papa.unparse({
    fields: data.headers,
    data: data.rows,
  });

  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = data.suggestedFileName;

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(objectUrl);
}

export function TeamWiseExportPanel() {
  const [previewData, setPreviewData] = useState<TeamWiseExportData | null>(
    null,
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleOpenPreview = async () => {
    setIsLoadingPreview(true);

    try {
      const response = await fetch("/api/admin/players/team-wise-export");
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load export preview");
      }

      const nextData = payload.data as TeamWiseExportData;
      setPreviewData(nextData);
      setIsPreviewOpen(true);
      toast.success("Preview loaded. Review columns before exporting.");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load export preview",
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleExport = async () => {
    if (!previewData) {
      toast.error("Preview data is not available yet.");
      return;
    }

    setIsExporting(true);

    try {
      downloadTeamWiseCsv(previewData);
      toast.success(`Exported ${previewData.suggestedFileName}`);
    } catch {
      toast.error("Failed to export CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-400 leading-relaxed">
          Preview team columns first, then export a CSV where each team is a
          column and player names are aligned row-wise. Unsold and Absentee are
          appended to the right.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleOpenPreview}
            disabled={isLoadingPreview}
            className="bg-accent-blue/20 border border-accent-blue/40 text-accent-blue hover:bg-accent-blue/30 hover:border-accent-blue/60"
          >
            {isLoadingPreview ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Loading Preview...
              </>
            ) : (
              <>
                <Eye className="size-4 mr-2" />
                Preview Columns & Export
              </>
            )}
          </Button>

          {previewData ? (
            <p className="text-xs text-slate-500 font-mono">
              Last preview: {previewData.rowCount} row
              {previewData.rowCount === 1 ? "" : "s"},
              {` ${previewData.summary.totalColumns} columns`}
            </p>
          ) : null}
        </div>
      </div>

      <TeamWiseExportPreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        data={previewData}
        isLoading={isLoadingPreview}
        isExporting={isExporting}
        onExport={handleExport}
      />
    </>
  );
}
