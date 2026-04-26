"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Eye, RefreshCw, RotateCcw, ShieldAlert, Shuffle, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WatchdogTeam {
  id: string;
  name: string;
  shortName: string | null;
  country: string | null;
  seedPot: number | null;
  assignedGroup: string | null;
  drawMode: string | null;
  stagedGroup: string | null;
  stagedDrawMode: string | null;
  stagedId: string | null;
}

interface SpinState {
  isSpinning: boolean;
  drawMode: "SINGLE" | "BATCH" | null;
}

interface Tournament {
  id: string;
  name: string;
  status: string;
}

const GROUP_LABELS = ["A", "B", "C", "D"] as const;
type GroupLabel = (typeof GROUP_LABELS)[number];

// ── Sub-components ─────────────────────────────────────────────────────────────

function SpinIndicator({ spinState }: { spinState: SpinState }) {
  if (!spinState.isSpinning) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2">
        <span className="size-2 rounded-full bg-slate-600" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Not Spinning
        </span>
      </div>
    );
  }

  const label =
    spinState.drawMode === "BATCH" ? "Batch Draw Ongoing" : "Single Draw Ongoing";

  const color =
    spinState.drawMode === "BATCH"
      ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
      : "border-amber-500/50 bg-amber-500/10 text-amber-300";

  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-4 py-2 animate-pulse ${color}`}
    >
      <span className="size-2 rounded-full bg-current" />
      <span className="text-xs font-semibold uppercase tracking-widest">{label}</span>
    </div>
  );
}

function TeamCard({
  team,
  stagedDrawMode,
  onStage,
  isLoading,
}: {
  team: WatchdogTeam;
  stagedDrawMode: "SINGLE" | "BATCH";
  onStage: (teamId: string, groupName: GroupLabel | null) => Promise<void>;
  isLoading: boolean;
}) {
  const isAssigned = !!team.assignedGroup;
  const stagedGroup = team.stagedGroup as GroupLabel | null;

  return (
    <div
      className={`rounded-xl border p-3 transition-all duration-200 ${
        isAssigned
          ? "border-slate-800/40 bg-slate-900/20 opacity-50"
          : "border-slate-700/60 bg-slate-900/50 hover:border-slate-600/60"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{team.name}</p>
          <p className="text-[11px] text-slate-500">
            {team.country ?? ""}
            {team.seedPot != null ? ` · Pot ${team.seedPot}` : ""}
          </p>
        </div>
        {isAssigned && (
          <span className="shrink-0 rounded-full border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            Grp {team.assignedGroup}
          </span>
        )}
      </div>

      {/* Group radio buttons */}
      <div className="flex items-center gap-1.5">
        {GROUP_LABELS.map((g) => {
          const isSelected = isAssigned
            ? team.assignedGroup === g
            : stagedGroup === g;
          const disabled = isAssigned || isLoading;

          return (
            <button
              key={g}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (stagedGroup === g) {
                  // Toggle off
                  onStage(team.id, null);
                } else {
                  onStage(team.id, g);
                }
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold transition-all duration-150 ${
                isSelected
                  ? "bg-violet-600 text-white ring-2 ring-violet-400/40"
                  : "border border-slate-700 bg-slate-800/60 text-slate-400 hover:border-violet-500/60 hover:text-slate-200"
              } disabled:cursor-not-allowed disabled:opacity-60`}
              title={`Assign to Group ${g}`}
            >
              {g}
            </button>
          );
        })}
        {!isAssigned && stagedGroup && (
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-widest text-violet-400">
            staged
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function WatchdogTeamsDist({ tournament }: { tournament: Tournament | null }) {
  const [teams, setTeams] = useState<WatchdogTeam[]>([]);
  const [spinState, setSpinState] = useState<SpinState>({
    isSpinning: false,
    drawMode: null,
  });
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [stagingTeamId, setStagingTeamId] = useState<string | null>(null);
  const [stagedDrawMode, setStagedDrawMode] = useState<"SINGLE" | "BATCH">("SINGLE");
  const sseRef = useRef<EventSource | null>(null);

  const tid = tournament?.id;

  // ── Fetch teams ──────────────────────────────────────────────────────────────
  const fetchTeams = useCallback(async () => {
    if (!tid) return;
    setLoadingTeams(true);
    try {
      const res = await fetch(`/api/watchgod/teams-dist/${tid}/teams`);
      const json = await res.json();
      if (json.success) setTeams(json.data);
    } catch {
      toast.error("Failed to load teams");
    } finally {
      setLoadingTeams(false);
    }
  }, [tid]);

  // ── SSE spin-state ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tid) return;

    fetchTeams();

    const es = new EventSource(`/api/watchgod/teams-dist/${tid}/spin-state`);
    sseRef.current = es;

    es.onmessage = (e) => {
      try {
        const state = JSON.parse(e.data) as SpinState;
        setSpinState(state);
        // When a spin completes, refresh the team list to show new assignments
        if (!state.isSpinning) {
          fetchTeams();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // EventSource will auto-reconnect; no need to handle manually
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [tid, fetchTeams]);

  // ── Stage a team ─────────────────────────────────────────────────────────────
  const stageTeam = useCallback(
    async (teamId: string, groupName: GroupLabel | null) => {
      if (!tid) return;
      setStagingTeamId(teamId);
      try {
        const res = await fetch(`/api/watchgod/teams-dist/${tid}/stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            groupName,
            drawMode: stagedDrawMode,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        setTeams((prev) =>
          prev.map((t) =>
            t.id === teamId
              ? {
                  ...t,
                  stagedGroup: groupName,
                  stagedDrawMode: groupName ? stagedDrawMode : null,
                  stagedId: json.data?.stagedId ?? t.stagedId,
                }
              : t
          )
        );
      } catch (err: any) {
        toast.error(err.message ?? "Failed to stage assignment");
      } finally {
        setStagingTeamId(null);
      }
    },
    [tid, stagedDrawMode]
  );

  // ── Clear all staged ─────────────────────────────────────────────────────────
  const clearAllStaged = useCallback(async () => {
    if (!tid) return;
    try {
      await fetch(`/api/watchgod/teams-dist/${tid}/stage`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setTeams((prev) => prev.map((t) => ({ ...t, stagedGroup: null, stagedDrawMode: null, stagedId: null })));
      toast.success("All staged assignments cleared");
    } catch {
      toast.error("Failed to clear staged assignments");
    }
  }, [tid]);

  const stagedCount = teams.filter((t) => t.stagedGroup).length;
  const assignedCount = teams.filter((t) => t.assignedGroup).length;
  const totalCount = teams.length;

  if (!tournament) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-pitch-950 text-slate-300">
        <ShieldAlert className="size-10 text-slate-600" />
        <p className="text-lg font-semibold">No active draw tournament found.</p>
        <p className="text-sm text-slate-500">
          Start a tournament and import teams before using this panel.
        </p>
        <Link href="/watchgod">
          <Button variant="outline" className="border-slate-700 text-slate-400">
            Back to Watchgod
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-pitch-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-pitch-900/90 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
              <Eye className="size-4 text-violet-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                Superadmin · Draw Control
              </p>
              <h1 className="text-sm font-bold tracking-wide md:text-base">
                Teams Distribution Watchdog
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SpinIndicator spinState={spinState} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchTeams}
              disabled={loadingTeams}
              className="border-slate-700 bg-slate-900/30 text-slate-400 hover:text-slate-200"
            >
              <RefreshCw className={`size-3.5 ${loadingTeams ? "animate-spin" : ""}`} />
            </Button>
            <Link href="/watchgod">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-slate-700 bg-slate-900/30 text-xs text-slate-300"
              >
                Watchgod Home
              </Button>
            </Link>
            <div className="flex shrink-0 items-center justify-center">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox:
                      "size-8 ring-2 ring-violet-400/40 hover:ring-violet-400/80 transition-all duration-200 rounded-full",
                  },
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6">
        {/* Stats + controls bar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-pitch-900/50 px-4 py-3">
          <div className="flex items-center gap-5">
            <Stat label="Total Teams" value={totalCount} />
            <Stat label="Assigned" value={assignedCount} color="text-emerald-400" />
            <Stat label="Remaining" value={totalCount - assignedCount} color="text-amber-400" />
            <Stat label="Staged" value={stagedCount} color="text-violet-400" />
          </div>

          <div className="flex items-center gap-3">
            {/* Draw mode selector for staging */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/40 p-1">
              {(["SINGLE", "BATCH"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setStagedDrawMode(m)}
                  className={`flex items-center gap-1 rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                    stagedDrawMode === m
                      ? "bg-violet-600 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {m === "SINGLE" ? <Zap className="size-3" /> : <Shuffle className="size-3" />}
                  {m === "SINGLE" ? "Single" : "Batch"}
                </button>
              ))}
            </div>

            {stagedCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAllStaged}
                className="border-rose-700/50 bg-rose-900/20 text-xs text-rose-400 hover:bg-rose-900/40"
              >
                <RotateCcw className="mr-1.5 size-3" />
                Clear Staged ({stagedCount})
              </Button>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-4 rounded-xl border border-violet-800/30 bg-violet-900/10 px-4 py-3 text-sm text-violet-300">
          <p>
            <strong>How it works:</strong> Select a group (A–D) for any unassigned team to{" "}
            <em>stage</em> that assignment. When the draw operator spins on the main draw page, the
            engine will consume the staged assignments instead of picking randomly — up to{" "}
            {stagedDrawMode === "BATCH" ? "4 teams for a batch draw" : "1 team for a single draw"}.
            Already-assigned teams are greyed out.
          </p>
        </div>

        {/* Team grid */}
        {teams.length === 0 && !loadingTeams ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-700">
            <ShieldAlert className="size-8 text-slate-600" />
            <p className="text-sm text-slate-500">No teams found for this tournament.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                stagedDrawMode={stagedDrawMode}
                onStage={stageTeam}
                isLoading={stagingTeamId === team.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  color = "text-slate-200",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`text-base font-bold ${color}`}>{value}</p>
    </div>
  );
}
