"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BatchDrawResult, GroupName, SingleDrawResult } from "@/types/teams-dist";

// ── Single reel ───────────────────────────────────────────────────────────────

function Reel({
  items,
  finalValue,
  isSpinning,
  delay = 0,
  accent = "violet",
}: {
  items: string[];
  finalValue: string;
  isSpinning: boolean;
  delay?: number;
  accent?: "violet" | "lime" | "amber";
}) {
  const [displayValue, setDisplayValue] = useState(finalValue || items[0] || "—");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const accentClasses = {
    violet: "border-violet-500/60 bg-violet-950/40 text-violet-200 shadow-[0_0_24px_rgba(139,92,246,0.3)]",
    lime: "border-[#ccff00]/60 bg-[#ccff00]/5 text-[#ccff00] shadow-[0_0_24px_rgba(204,255,0,0.25)]",
    amber: "border-amber-500/60 bg-amber-950/40 text-amber-200 shadow-[0_0_24px_rgba(245,158,11,0.3)]",
  };

  useEffect(() => {
    if (isSpinning) {
      let i = 0;
      intervalRef.current = setInterval(() => {
        setDisplayValue(items[i % items.length] ?? "—");
        i++;
      }, 80);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Deceleration: show final value after a short delay
      const timeout = setTimeout(
        () => setDisplayValue(finalValue || "—"),
        delay
      );
      return () => clearTimeout(timeout);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSpinning, items, finalValue, delay]);

  return (
    <div
      className={`relative flex h-20 w-full items-center justify-center overflow-hidden rounded-xl border-2 font-mono font-black tracking-wider transition-all duration-700 ${accentClasses[accent]}`}
    >
      {/* Scanline shimmer */}
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.08)_2px,rgba(0,0,0,0.08)_4px)]" />

      <AnimatePresence mode="popLayout">
        <motion.span
          key={displayValue}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -24, opacity: 0 }}
          transition={{ duration: 0.08 }}
          className="relative z-10 truncate px-4 text-center text-xl"
        >
          {displayValue}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ── Single-team slot machine ──────────────────────────────────────────────────

export function SingleSlotMachine({
  teamNames,
  groupNames,
  result,
  isSpinning,
}: {
  teamNames: string[];
  groupNames: string[];
  result: SingleDrawResult | null;
  isSpinning: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-500">
        Team Reel
      </p>
      <Reel
        items={teamNames.length > 0 ? teamNames : ["—"]}
        finalValue={result?.team.name ?? ""}
        isSpinning={isSpinning}
        accent="lime"
      />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-800" />
        <span className="text-xs text-slate-600 font-mono">→</span>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-500">
        Group Reel
      </p>
      <Reel
        items={groupNames.length > 0 ? groupNames : ["A", "B", "C", "D"]}
        finalValue={result?.group ? `Group ${result.group}` : ""}
        isSpinning={isSpinning}
        delay={300}
        accent="violet"
      />
    </div>
  );
}

// ── Batch (4-team) slot machine ───────────────────────────────────────────────

const GROUP_BADGE_COLORS: Record<GroupName, string> = {
  A: "bg-violet-900/60 text-violet-300 border-violet-600/40",
  B: "bg-amber-900/60 text-amber-300 border-amber-600/40",
  C: "bg-emerald-900/60 text-emerald-300 border-emerald-600/40",
  D: "bg-sky-900/60 text-sky-300 border-sky-600/40",
};

export function BatchSlotMachine({
  teamNames,
  result,
  isSpinning,
}: {
  teamNames: string[];
  result: BatchDrawResult | null;
  isSpinning: boolean;
}) {
  const slots = result?.assignments ?? [];

  return (
    <div className="grid grid-cols-2 gap-3">
      {(["A", "B", "C", "D"] as GroupName[]).map((g, i) => (
        <div key={g} className="flex flex-col gap-1.5">
          <div
            className={`flex h-7 items-center justify-center rounded-lg border text-xs font-bold tracking-widest ${GROUP_BADGE_COLORS[g]}`}
          >
            Group {g}
          </div>
          <Reel
            items={teamNames.length > 0 ? teamNames : ["—"]}
            finalValue={slots[i]?.team.name ?? ""}
            isSpinning={isSpinning}
            delay={i * 200}
            accent={i === 0 ? "violet" : i === 1 ? "amber" : "lime"}
          />
        </div>
      ))}
    </div>
  );
}
