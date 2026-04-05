"use client";

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TeamWiseExportData } from "@/features/player-export/teamWiseExport";

interface TeamWiseExportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: TeamWiseExportData | null;
  isLoading: boolean;
  isExporting: boolean;
  onExport: () => void;
}

export function TeamWiseExportPreviewDialog({
  open,
  onOpenChange,
  data,
  isLoading,
  isExporting,
  onExport,
}: TeamWiseExportPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-7xl sm:max-w-[96vw] lg:max-w-6xl max-h-[90vh] bg-pitch-900 border-slate-800 text-slate-100 p-0 overflow-hidden sm:rounded-2xl shadow-2xl flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="text-xl font-bold text-slate-100">
            Team-Wise Export Preview
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Preview all columns before exporting the CSV.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="px-6 pb-6 pt-4 flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading latest export preview...
          </div>
        ) : !data ? (
          <div className="px-6 pb-6 pt-4 text-slate-400 text-sm">
            No preview data available.
          </div>
        ) : (
          <div className="px-6 pb-6 pt-4 flex flex-col gap-4 flex-1 min-h-0">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs font-mono uppercase tracking-widest shrink-0">
              <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2">
                <p className="text-slate-500">Columns</p>
                <p className="text-slate-100 text-sm mt-1">
                  {data.summary.totalColumns}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2">
                <p className="text-slate-500">Team Columns</p>
                <p className="text-slate-100 text-sm mt-1">
                  {data.summary.teamColumns}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2">
                <p className="text-slate-500">Team Players</p>
                <p className="text-slate-100 text-sm mt-1">
                  {data.summary.teamAssignedPlayers}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2">
                <p className="text-slate-500">Unsold</p>
                <p className="text-slate-100 text-sm mt-1">
                  {data.summary.unsoldPlayers}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2">
                <p className="text-slate-500">Absentee</p>
                <p className="text-slate-100 text-sm mt-1">
                  {data.summary.absenteePlayers}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-pitch-950/70 flex-1 overflow-auto min-h-0 relative">
              <table className="w-full min-w-max text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-pitch-950 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-slate-500 uppercase tracking-widest font-mono w-14">
                      #
                    </th>
                    {data.headers.map((header) => (
                      <th
                        key={header}
                        className="px-3 py-2 text-left text-xs text-slate-500 uppercase tracking-widest font-mono whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-6 text-slate-500 text-sm"
                        colSpan={data.headers.length + 1}
                      >
                        No rows available for export.
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const rowKeyOccurrences = new Map<string, number>();
                      let rowNumber = 0;

                      return data.rows.map((row) => {
                        rowNumber += 1;
                        const baseRowKey = row.join("||") || "__empty_row__";
                        const occurrence =
                          (rowKeyOccurrences.get(baseRowKey) ?? 0) + 1;
                        rowKeyOccurrences.set(baseRowKey, occurrence);

                        const rowKey = `${baseRowKey}::${occurrence}`;

                        return (
                          <tr
                            key={rowKey}
                            className="border-b border-slate-800/60"
                          >
                            <td className="px-3 py-2 text-[11px] text-slate-500 font-mono">
                              {rowNumber}
                            </td>
                            {data.headers.map((header, columnIndex) => (
                              <td
                                key={`${rowKey}::${header}`}
                                className="px-3 py-2 text-slate-200 whitespace-nowrap"
                              >
                                {row[columnIndex] || ""}
                              </td>
                            ))}
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 shrink-0 pt-2">
              <p className="text-xs text-slate-500 font-mono">
                {data.rowCount} preview row{data.rowCount === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={onExport}
                  disabled={isExporting || data.rowCount === 0}
                  className="bg-accent-gold text-pitch-950 hover:bg-accent-gold/90 font-bold"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="size-4 mr-2" />
                      Export CSV
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
