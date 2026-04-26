"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Users,
  Shuffle,
  LayoutGrid,
  Loader2,
} from "lucide-react";
import { useGroupBoard, useTeams, useTournament } from "@/hooks/useTeamsDist";
import { TeamImport } from "@/components/teams-dist/TeamImport";
import { DrawArena } from "@/components/teams-dist/DrawArena";
import { GroupBoard } from "@/components/teams-dist/GroupBoard";
import { ROUTES } from "@/lib/constants";

type Tab = "teams" | "draw" | "groups";

const TABS: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: "teams", label: "Teams", icon: Users },
  { id: "draw", label: "Draw Arena", icon: Shuffle },
  { id: "groups", label: "Groups", icon: LayoutGrid },
];

const STATUS_LABELS: Record<string, string> = {
  SETUP: "Setup",
  TEAMS_READY: "Teams Ready",
  DRAW_IN_PROGRESS: "Draw In Progress",
  DRAW_COMPLETE: "Draw Complete",
};

const STATUS_COLORS: Record<string, string> = {
  SETUP: "bg-slate-800 text-slate-400",
  TEAMS_READY: "bg-violet-900/60 text-violet-300",
  DRAW_IN_PROGRESS: "bg-amber-900/60 text-amber-300",
  DRAW_COMPLETE: "bg-emerald-900/60 text-emerald-300",
};

export function TournamentDetailView({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { data: tournament, isLoading: tLoading } = useTournament(tournamentId);
  const { data: teams, isLoading: teamsLoading, refetch: refetchTeams } = useTeams(tournamentId);
  const { data: board } = useGroupBoard(tournamentId);
  const [tab, setTab] = useState<Tab>("teams");

  if (tLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-slate-400">Tournament not found.</p>
        <Link href={ROUTES.TEAMS_DIST} className="text-violet-400 hover:underline text-sm">
          ← Back to tournaments
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-neutral-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-4">
          <Link
            href={ROUTES.TEAMS_DIST}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Tournaments
          </Link>
          <span className="text-slate-700">/</span>
          <span className="font-semibold text-slate-200 truncate max-w-xs">
            {tournament.name}
          </span>
          <span
            className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider ${STATUS_COLORS[tournament.status] ?? "bg-slate-800 text-slate-400"}`}
          >
            {STATUS_LABELS[tournament.status] ?? tournament.status}
          </span>
        </div>

        {/* Tabs */}
        <div className="mx-auto flex max-w-7xl px-6">
          <div className="flex gap-0 border-b border-slate-800 w-full">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === id
                    ? "border-violet-500 text-violet-300"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon className="size-4" />
                {label}
                {id === "teams" && teams != null && (
                  <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[0.6rem] font-mono text-slate-500">
                    {teams.length}/16
                  </span>
                )}
                {id === "groups" && board != null && (
                  <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[0.6rem] font-mono text-slate-500">
                    {(teams?.length ?? 0) - board.unassigned.length}/16
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Tab content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {tab === "teams" && (
              <div className="max-w-2xl">
                <h2 className="mb-5 text-xl font-bold text-slate-100">
                  Team Import
                </h2>
                {teamsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-violet-500" />
                  </div>
                ) : (
                  <TeamImport
                    tournamentId={tournamentId}
                    teams={teams ?? []}
                    onImported={() => refetchTeams()}
                  />
                )}
              </div>
            )}

            {tab === "draw" && (
              <div>
                <h2 className="mb-5 text-xl font-bold text-slate-100">
                  Draw Arena
                </h2>
                {(teams?.length ?? 0) < 16 ? (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-800 py-20 text-center">
                    <Users className="size-10 text-slate-700" />
                    <p className="font-semibold text-slate-400">
                      Import 16 teams first
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab("teams")}
                      className="text-sm text-violet-400 hover:underline"
                    >
                      Go to Teams tab →
                    </button>
                  </div>
                ) : (
                  <DrawArena tournamentId={tournamentId} />
                )}
              </div>
            )}

            {tab === "groups" && (
              <div>
                <h2 className="mb-5 text-xl font-bold text-slate-100">
                  Group Board
                </h2>
                {board ? (
                  <GroupBoard groups={board.groups} />
                ) : (
                  <div className="flex justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-violet-500" />
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
