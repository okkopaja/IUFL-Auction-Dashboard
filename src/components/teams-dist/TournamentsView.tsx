"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trophy, Users, Shuffle, ArrowRight, Trash2, Loader2 } from "lucide-react";
import { useCreateTournament, useDeleteTournament, useTournaments } from "@/hooks/useTeamsDist";
import type { TdTournament } from "@/types/teams-dist";
import { toast } from "sonner";
import { ROUTES } from "@/lib/constants";

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

function TournamentCard({
  tournament,
  onDelete,
}: {
  tournament: TdTournament;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      className="group relative flex flex-col gap-4 rounded-xl border border-slate-800 bg-[#0d1218]/80 p-5 hover:border-violet-500/40 transition-colors duration-200"
    >
      {/* Corner accents */}
      <span className="absolute top-0 left-0 h-2 w-2 border-l border-t border-violet-500/50" />
      <span className="absolute bottom-0 right-0 h-2 w-2 border-r border-b border-violet-500/50" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-violet-900/40 border border-violet-700/30">
            <Trophy className="size-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 leading-tight">{tournament.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date(tournament.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider ${STATUS_COLORS[tournament.status] ?? "bg-slate-800 text-slate-400"}`}
        >
          {STATUS_LABELS[tournament.status] ?? tournament.status}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Users className="size-3.5" />
          {tournament.teamCount ?? 0} / 16 teams
        </span>
        <span className="flex items-center gap-1.5">
          <Shuffle className="size-3.5" />
          {tournament.assignedCount ?? 0} assigned
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Link
          href={`${ROUTES.TEAMS_DIST}/${tournament.id}`}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-violet-600/50 bg-violet-900/30 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-900/50 hover:border-violet-500 transition-colors duration-150"
        >
          Open
          <ArrowRight className="size-4" />
        </Link>
        <button
          type="button"
          onClick={() => onDelete(tournament.id)}
          className="flex size-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/30 text-slate-500 hover:border-red-500/50 hover:text-red-400 transition-colors duration-150"
          aria-label="Delete tournament"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </motion.div>
  );
}

function CreateTournamentModal({
  onClose,
  onCreate,
  isPending,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-[#0d1218] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-100 mb-1">New Tournament</h2>
        <p className="text-sm text-slate-500 mb-5">
          Create a 16-team, 4-group tournament.
        </p>

        <input
          autoFocus
          type="text"
          placeholder="Tournament name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onCreate(name.trim());
            if (e.key === "Escape") onClose();
          }}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-violet-500 transition-colors mb-4"
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-700 bg-transparent px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || isPending}
            onClick={() => onCreate(name.trim())}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Create
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function TournamentsView() {
  const { data: tournaments, isLoading, error } = useTournaments();
  const createMutation = useCreateTournament();
  const deleteMutation = useDeleteTournament();
  const [showCreate, setShowCreate] = useState(false);

  function handleCreate(name: string) {
    createMutation.mutate(
      { name },
      {
        onSuccess: () => {
          setShowCreate(false);
          toast.success(`Tournament "${name}" created`);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleDelete(id: string) {
    const t = tournaments?.find((t) => t.id === id);
    if (!t) return;
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success("Tournament deleted"),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-neutral-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
              ← Home
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-sm font-semibold text-slate-200 uppercase tracking-widest">
              Teams Draw
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            <Plus className="size-4" />
            New Tournament
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black uppercase italic tracking-tight text-white">
            Tournaments
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your 16-team group draws.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="size-8 animate-spin text-violet-500" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-6 text-sm text-red-300">
            Failed to load tournaments: {error.message}
          </div>
        )}

        {!isLoading && !error && tournaments?.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-800 py-24 text-center"
          >
            <Trophy className="size-12 text-slate-700" />
            <div>
              <p className="font-semibold text-slate-400">No tournaments yet</p>
              <p className="text-sm text-slate-600 mt-1">
                Create your first tournament to start drawing groups.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-2 flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
            >
              <Plus className="size-4" /> New Tournament
            </button>
          </motion.div>
        )}

        {!isLoading && !error && tournaments && tournaments.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {tournaments.map((t) => (
                <TournamentCard key={t.id} tournament={t} onDelete={handleDelete} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateTournamentModal
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
            isPending={createMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
