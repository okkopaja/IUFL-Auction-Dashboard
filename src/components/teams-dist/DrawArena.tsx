"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shuffle,
  Zap,
  Undo2,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";

import { useDraw, useGroupBoard } from "@/hooks/useTeamsDist";
import {
  BatchSlotMachine,
  SingleSlotMachine,
} from "@/components/teams-dist/SlotMachine";
import { GroupBoard } from "@/components/teams-dist/GroupBoard";
import type {
  BatchDrawResult,
  DrawRequest,
  SingleDrawResult,
} from "@/types/teams-dist";
import { toast } from "sonner";

type DrawMode = "single" | "batch";

interface DrawLog {
  id: string;
  text: string;
  type: "single" | "batch" | "undo" | "complete";
  ts: string;
}

export function DrawArena({ tournamentId }: { tournamentId: string }) {
  const { data: board, refetch } = useGroupBoard(tournamentId);
  const drawMutation = useDraw(tournamentId);

  const [drawMode, setDrawMode] = useState<DrawMode>("single");
  const [isSpinning, setIsSpinning] = useState(false);
  const [singleResult, setSingleResult] = useState<SingleDrawResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchDrawResult | null>(null);
  const [drawLog, setDrawLog] = useState<DrawLog[]>([]);
  const spinTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unassigned = board?.unassigned ?? [];
  const teamNames = unassigned.map((t) => t.name);
  const groupNames = ["Group A", "Group B", "Group C", "Group D"];

  function addLog(text: string, type: DrawLog["type"]) {
    const entry: DrawLog = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      type,
      ts: new Date().toLocaleTimeString(),
    };
    setDrawLog((prev) => [entry, ...prev.slice(0, 19)]);
  }

  function triggerDraw() {
    if (isSpinning || drawMutation.isPending) return;

    // Clear previous results
    setSingleResult(null);
    setBatchResult(null);

    setIsSpinning(true);
    const payload: DrawRequest =
      drawMode === "single" ? { mode: "single" } : { mode: "batch" };

    drawMutation.mutate(payload, {
      onSuccess: (result) => {
        // Keep spinning for drama (2700ms), then lock the result
        spinTimeout.current = setTimeout(() => {
          setIsSpinning(false);
          if (result.mode === "single") {
            setSingleResult(result);
            addLog(
              `${result.team.name} → Group ${result.group}`,
              "single"
            );
          } else if (result.mode === "batch") {
            setBatchResult(result);
            const summary = result.assignments
              .map((a) => `${a.team.name}→${a.group}`)
              .join(", ");
            addLog(`Batch: ${summary}`, "batch");
          }
          if (result.mode !== "undo" && (board?.unassigned.length ?? 0) <= 1) {
            addLog("🏆 Draw complete!", "complete");
          }
        }, 2700);
      },
      onError: (err) => {
        setIsSpinning(false);
        toast.error(err.message);
      },
    });
  }

  function triggerUndo() {
    drawMutation.mutate(
      { mode: "undo" },
      {
        onSuccess: (result) => {
          setSingleResult(null);
          setBatchResult(null);
          if (result.mode === "undo") {
            addLog(`Undo: reverted ${result.removedTeamIds.length} assignment(s)`, "undo");
            toast.success("Last draw reverted");
          }
          refetch();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function triggerReset() {
    if (isSpinning || drawMutation.isPending) return;
    if (!confirm("Reset the entire draw session? This cannot be undone.")) return;
    drawMutation.mutate(
      { mode: "reset" },
      {
        onSuccess: () => {
          setSingleResult(null);
          setBatchResult(null);
          setDrawLog([]);
          toast.success("Draw session reset");
          refetch();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  const canDraw =
    drawMode === "single"
      ? (board?.canDrawSingle ?? false)
      : (board?.canDrawBatch ?? false);

  return (
    <div className="flex flex-col gap-6">
      {/* Draw mode toggle */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/40 p-1">
          {(["single", "batch"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setDrawMode(m);
                setSingleResult(null);
                setBatchResult(null);
              }}
              className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                drawMode === m
                  ? "bg-violet-600 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {m === "single" ? (
                <Zap className="size-3" />
              ) : (
                <Shuffle className="size-3" />
              )}
              {m === "single" ? "Single Draw" : "Batch Draw (4)"}
            </button>
          ))}
        </div>

        <button
            type="button"
            onClick={triggerReset}
            disabled={drawMutation.isPending || isSpinning}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-rose-600/50 hover:text-rose-300 disabled:opacity-40 transition-colors"
          >
            <RotateCcw className="size-3.5" />
            Reset Session
          </button>

        {board?.canUndo && (
          <button
            type="button"
            onClick={triggerUndo}
            disabled={drawMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-amber-600/50 hover:text-amber-300 disabled:opacity-40 transition-colors"
          >
            <Undo2 className="size-3.5" />
            Undo Last
          </button>
        )}
      </div>

      {/* 3-panel layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr_1fr]">
        {/* Left: Unassigned pool */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0d1218]/60 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Pool ({unassigned.length} remaining)
          </h3>
          <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto">
            <AnimatePresence>
              {unassigned.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-2 py-8 text-center"
                >
                  <CheckCircle2 className="size-8 text-emerald-500" />
                  <p className="text-sm font-semibold text-emerald-400">
                    All teams assigned!
                  </p>
                </motion.div>
              ) : (
                unassigned.map((team) => (
                  <motion.div
                    key={team.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="rounded-lg border border-slate-800/60 bg-slate-900/30 px-3 py-2 text-sm text-slate-300"
                  >
                    {team.name}
                    {team.country && (
                      <span className="ml-1.5 text-xs text-slate-600">
                        {team.country}
                      </span>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center: Slot machine + controls */}
        <div className="flex flex-col gap-5 rounded-xl border border-violet-800/30 bg-[#0a0611]/80 p-5">
          <div className="text-center">
            <h2 className="text-xs font-bold uppercase tracking-[0.4em] text-violet-500">
              Draw Arena
            </h2>
          </div>

          {/* Slot machine */}
          <div className="flex-1">
            {drawMode === "single" ? (
              <SingleSlotMachine
                teamNames={teamNames}
                groupNames={groupNames}
                result={singleResult}
                isSpinning={isSpinning}
              />
            ) : (
              <BatchSlotMachine
                teamNames={teamNames}
                result={batchResult}
                isSpinning={isSpinning}
              />
            )}
          </div>

          {/* Spin button */}
          <button
            type="button"
            disabled={!canDraw || isSpinning || drawMutation.isPending}
            onClick={triggerDraw}
            className="group relative flex items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-violet-600 py-4 text-base font-black uppercase tracking-widest text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_4px_24px_rgba(139,92,246,0.4)]"
          >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            {isSpinning || drawMutation.isPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : drawMode === "single" ? (
              <Zap className="size-5" />
            ) : (
              <Shuffle className="size-5" />
            )}
            {isSpinning
              ? "Spinning…"
              : drawMode === "single"
              ? "Spin Draw"
              : "Spin Group Draw"}
          </button>

          {/* Latest result pill */}
          <AnimatePresence>
            {singleResult && !isSpinning && (
              <motion.div
                key="single-result"
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 text-center text-sm text-emerald-300 font-semibold"
              >
                ✓ {singleResult.team.name} → Group {singleResult.group}
              </motion.div>
            )}
            {batchResult && !isSpinning && (
              <motion.div
                key="batch-result"
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 text-xs text-emerald-300 font-semibold space-y-0.5"
              >
                {batchResult.assignments.map((a) => (
                  <div key={a.team.id}>
                    ✓ {a.team.name} → Group {a.group}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Not enough teams warning */}
          {!canDraw && unassigned.length > 0 && drawMode === "batch" && (
            <div className="flex items-center gap-1.5 text-xs text-amber-500">
              <AlertCircle className="size-3.5" />
              Need ≥4 unassigned teams for batch draw
            </div>
          )}

          {/* Draw log */}
          {drawLog.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-slate-800/60 pt-3 max-h-36 overflow-y-auto">
              <p className="text-[0.6rem] uppercase tracking-widest text-slate-600 mb-1">
                Event Log
              </p>
              {drawLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="font-mono text-slate-700 shrink-0">
                    {entry.ts}
                  </span>
                  <span
                    className={
                      entry.type === "undo"
                        ? "text-amber-400"
                        : entry.type === "complete"
                        ? "text-emerald-400 font-semibold"
                        : "text-slate-400"
                    }
                  >
                    {entry.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Group board */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0d1218]/60 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Groups
          </h3>
          {board?.groups && <GroupBoard groups={board.groups} />}
        </div>
      </div>

      {/* Export row */}
      {board && (board.isComplete || !board.canDrawSingle || !board.canDrawBatch) && (board.unassigned.length < 16) && (
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <a
            href={`/api/teams-dist/tournaments/${tournamentId}/export?format=csv`}
            download
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-2 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
          >
            <Download className="size-4" />
            Export CSV
          </a>
          <a
            href={`/api/teams-dist/tournaments/${tournamentId}/export?format=json`}
            download
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-2 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
          >
            <Download className="size-4" />
            Export JSON
          </a>
        </div>
      )}
    </div>
  );
}
