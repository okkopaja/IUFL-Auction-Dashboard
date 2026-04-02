"use client";

import { CheckCircle2, Database, ReceiptText, Users } from "lucide-react";
import type { ImportCommitResult } from "@/features/player-import/types";

interface ImportSummaryCardProps {
  result: ImportCommitResult;
}

export function ImportSummaryCard({ result }: ImportSummaryCardProps) {
  const isAppend = result.mode === "APPEND";

  const items = isAppend
    ? [
        {
          icon: <Users className="size-4 text-accent-green" />,
          label: "Players Added",
          value: result.insertedCount,
          color: "text-accent-green",
        },
        {
          icon: <Users className="size-4 text-accent-blue" />,
          label: "Players Updated",
          value: result.updatedCount,
          color: "text-accent-blue",
        },
        {
          icon: <ReceiptText className="size-4 text-slate-400" />,
          label: "Rows Skipped",
          value: result.skippedCount,
          color: "text-slate-300",
        },
        {
          icon: <Database className="size-4 text-accent-blue" />,
          label: "Session ID",
          value: `${result.sessionId.slice(0, 8)}…`,
          color: "text-accent-blue",
        },
      ]
    : [
        {
          icon: <Users className="size-4 text-accent-green" />,
          label: "Players Imported",
          value: result.importedCount,
          color: "text-accent-green",
        },
        {
          icon: <Users className="size-4 text-red-400" />,
          label: "Players Removed",
          value: result.removedPlayersCount,
          color: "text-red-400",
        },
        {
          icon: <ReceiptText className="size-4 text-slate-400" />,
          label: "Transactions Cleared",
          value: result.removedTransactionsCount,
          color: "text-slate-300",
        },
        {
          icon: <Database className="size-4 text-accent-blue" />,
          label: "Session ID",
          value: `${result.sessionId.slice(0, 8)}…`,
          color: "text-accent-blue",
        },
      ];

  return (
    <div className="rounded-xl border border-accent-green/30 bg-accent-green/5 px-6 py-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 text-accent-green font-semibold text-sm">
        <CheckCircle2 className="size-4" />
        {isAppend ? "Append Import Successful" : "Replace Import Successful"}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 uppercase tracking-widest font-mono">
              {item.icon}
              {item.label}
            </div>
            <p className={`text-2xl font-bold font-mono ${item.color}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
