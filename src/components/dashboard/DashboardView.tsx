"use client";

import { Gavel, Search, Users, UserX, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuctionStats, useTeams } from "@/hooks/useAuction";
import { ROUTES } from "@/lib/constants";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { ThemeToggle } from "../shared/ThemeToggle";
import { Button } from "../ui/button";
import { TeamGrid } from "./TeamGrid";
import type { Team } from "@/types";

function filterTeams(teams: Team[], query: string): Team[] {
  const q = query.trim().toLowerCase();
  if (!q) return teams;
  return teams.filter(
    (t) =>
      t.shortCode.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.domain.toLowerCase().includes(q),
  );
}

export function DashboardView() {
  const { data: teams, isLoading, error, refetch } = useTeams();
  const { data: stats } = useAuctionStats();
  const [query, setQuery] = useState("");

  const filteredTeams = useMemo(
    () => filterTeams(teams ?? [], query),
    [teams, query],
  );

  if (isLoading) return <LoadingState />;
  if (error)
    return <ErrorState error={error as Error} reset={() => refetch()} />;
  if (!teams || teams.length === 0)
    return (
      <div className="text-center text-muted-foreground p-12">
        No active auction session.
      </div>
    );

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 z-10 relative mt-8">
      {/* Theme toggle — top-right corner */}
      <div className="absolute top-0 right-0 z-50">
        <ThemeToggle />
      </div>

      {/* Title */}
      <h1 className="text-3xl md:text-5xl font-bold uppercase tracking-wide font-heading pr-16">
        IUFL 2026 Player <span className="text-accent-gold">Auction</span>
      </h1>

      {/* Global search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          id="dashboard-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams…"
          className="w-full h-11 pl-11 pr-10 rounded-xl bg-pitch-900/60 border border-slate-700/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-slate-500 focus:bg-pitch-900/80 transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main grid + sidebar */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Team cards */}
        <div className="flex-1">
          {filteredTeams.length === 0 ? (
            <p className="text-slate-500 text-sm py-12 text-center">
              No teams match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <TeamGrid teams={filteredTeams} />
          )}
        </div>

        {/* Right sidebar */}
        <div className="flex-shrink-0 w-full lg:w-72 flex flex-col gap-4">
          {/* Stats badge */}
          <div className="bg-pitch-900/50 border border-slate-800 rounded-xl px-5 py-3 backdrop-blur-md">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">
              Total Players
            </p>
            <p className="text-3xl font-bold font-heading text-slate-100">200</p>
          </div>

          {/* Sold Players link */}
          <Link href={ROUTES.PLAYERS_SOLD} className="block w-full">
            <div className="flex items-center justify-between w-full px-5 py-4 rounded-xl bg-pitch-900/50 border border-slate-800 hover:border-slate-700 hover:bg-pitch-900/80 transition-all group cursor-pointer">
              <span className="flex items-center gap-3">
                <Users className="w-5 h-5 text-accent-gold" />
                <span className="font-semibold text-slate-200 group-hover:text-white transition-colors">
                  Sold Players
                </span>
              </span>
              <span className="font-mono text-sm font-bold text-accent-gold bg-accent-gold/10 border border-accent-gold/30 px-2 py-0.5 rounded-md">
                {stats?.soldCount ?? "—"}
              </span>
            </div>
          </Link>

          {/* Unsold Players link */}
          <Link href={ROUTES.PLAYERS_UNSOLD} className="block w-full">
            <div className="flex items-center justify-between w-full px-5 py-4 rounded-xl bg-pitch-900/50 border border-slate-800 hover:border-slate-700 hover:bg-pitch-900/80 transition-all group cursor-pointer">
              <span className="flex items-center gap-3">
                <UserX className="w-5 h-5 text-slate-400" />
                <span className="font-semibold text-slate-200 group-hover:text-white transition-colors">
                  Unsold Players
                </span>
              </span>
              <span className="font-mono text-sm font-bold text-slate-400 bg-slate-700/30 border border-slate-700/60 px-2 py-0.5 rounded-md">
                {stats?.unsoldCount ?? "—"}
              </span>
            </div>
          </Link>

          {/* Enter Auction */}
          <Link href={ROUTES.AUCTION} className="block w-full mt-2">
            <Button
              size="lg"
              className="w-full h-16 text-lg tracking-wide shadow-lg shadow-accent-gold/20 hover:shadow-accent-gold/40 border-accent-gold text-white bg-accent-gold/20 hover:bg-accent-gold/40 hover:text-white font-bold uppercase group transition-all"
              variant="outline"
            >
              <Gavel className="mr-2 h-6 w-6 group-hover:scale-110 transition-transform text-accent-gold" />
              Enter Auction Area
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
