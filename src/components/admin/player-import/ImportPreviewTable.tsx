"use client";

import { AlertCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ImportDraftRow } from "@/features/player-import/types";

interface ImportPreviewTableProps {
  rows: ImportDraftRow[];
  onRemoveRow: (key: string) => void;
  onEditCell: (key: string, field: keyof ImportDraftRow, value: string) => void;
}

const EDITABLE_FIELDS: Array<{
  key: keyof ImportDraftRow;
  label: string;
  width?: string;
}> = [
  { key: "name", label: "Name" },
  { key: "year", label: "Year", width: "w-20" },
  { key: "whatsappNumber", label: "WhatsApp", width: "w-36" },
  { key: "stream", label: "Stream", width: "w-28" },
  { key: "position1", label: "Position 1", width: "w-28" },
  { key: "position2", label: "Position 2", width: "w-28" },
];

export function ImportPreviewTable({
  rows,
  onRemoveRow,
  onEditCell,
}: ImportPreviewTableProps) {
  const [editingCell, setEditingCell] = useState<{
    key: string;
    field: string;
  } | null>(null);

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        No rows to preview
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-pitch-950/60 max-h-[400px] overflow-y-auto">
      <table className="w-full text-sm border-collapse min-w-[800px]">
        <thead className="sticky top-0 z-10 bg-pitch-950 border-b border-slate-800">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-mono text-slate-500 uppercase tracking-widest w-12">
              #
            </th>
            {EDITABLE_FIELDS.map((f) => (
              <th
                key={f.key}
                className={`px-3 py-3 text-left text-xs font-mono text-slate-500 uppercase tracking-widest ${f.width ?? ""}`}
              >
                {f.label}
              </th>
            ))}
            <th className="px-3 py-3 text-xs font-mono text-slate-500 uppercase tracking-widest text-center w-16">
              Status
            </th>
            <th className="px-3 py-3 w-12" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row._key}
              className={`border-b border-slate-800/40 transition-colors ${
                row.hasErrors
                  ? "bg-red-950/20 hover:bg-red-950/30"
                  : "hover:bg-slate-800/20"
              }`}
            >
              <td className="px-3 py-2 text-slate-600 font-mono text-xs">
                {idx + 1}
              </td>
              {EDITABLE_FIELDS.map((f) => {
                const isEditing =
                  editingCell?.key === row._key && editingCell?.field === f.key;
                const cellError = row.errors[f.key as string];
                const val = (row[f.key] as string | null) ?? "";
                return (
                  <td key={f.key} className="px-1 py-1">
                    {isEditing ? (
                      <input
                        autoFocus
                        defaultValue={val}
                        className="w-full bg-slate-800 border border-accent-gold/50 rounded px-2 py-1 text-slate-100 text-sm outline-none focus:border-accent-gold"
                        onBlur={(e) => {
                          onEditCell(row._key, f.key, e.target.value);
                          setEditingCell(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Escape") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingCell({
                            key: row._key,
                            field: f.key as string,
                          })
                        }
                        title={cellError ?? "Click to edit"}
                        className={`w-full text-left px-2 py-1 rounded hover:bg-slate-700/40 transition-colors truncate ${
                          cellError
                            ? "text-red-400 ring-1 ring-red-500/50 rounded"
                            : val
                              ? "text-slate-200"
                              : "text-slate-600 italic"
                        }`}
                      >
                        {val || "—"}
                      </button>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-center">
                {row.hasErrors ? (
                  <span title={Object.values(row.errors).join(", ")}>
                    <AlertCircle className="size-3.5 text-red-400 mx-auto" />
                  </span>
                ) : (
                  <span className="text-xs font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">
                    UNSOLD
                  </span>
                )}
              </td>
              <td className="px-2 py-2 text-center">
                <button
                  type="button"
                  onClick={() => onRemoveRow(row._key)}
                  className="text-slate-600 hover:text-red-400 transition-colors"
                  title="Remove row"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
