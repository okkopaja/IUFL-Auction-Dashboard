"use client";

import { ArrowLeft, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TeamGrid } from "@/components/dashboard/TeamGrid";
import { LoadingState } from "@/components/shared/LoadingState";
import { useTeams } from "@/hooks/useAuction";
import { ROUTES } from "@/lib/constants";

export default function TeamsPage() {
  const { data: teams, isLoading } = useTeams();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!teams) return [];
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.shortCode.toLowerCase().includes(q),
    );
  }, [teams, query]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-8 md:px-12 relative bg-[#080a0f] text-white">
      {/* Background blobs */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-900/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-5xl flex flex-col gap-8 relative z-10">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <Link
            href={ROUTES.HOME}
            className="flex items-center gap-2 text-slate-400 hover:text-[#ccff00] transition-colors text-sm font-medium font-mono uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-wide font-heading text-white">
            Participating Teams
          </h1>
          {teams && (
            <p className="text-slate-500 text-sm mt-2 font-mono">
              {filtered.length} {query ? `of ${teams.length} ` : ""}teams
              registered
            </p>
          )}
        </div>

        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams by name or code..."
            className="w-full h-12 pl-11 pr-10 rounded-xl bg-slate-900/60 border border-slate-700/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-[#ccff00]/50 focus:bg-slate-900/80 transition-all font-mono"
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

        {/* Grid */}
        {isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500 font-mono">
            {query ? "No teams match your search." : "No teams configured yet."}
          </div>
        ) : (
          <TeamGrid teams={filtered} />
        )}
      </div>
    </div>
  );
}
