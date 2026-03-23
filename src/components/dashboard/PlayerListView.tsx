"use client";

import { ArrowLeft, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePlayers } from "@/hooks/useAuction";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Player } from "@/types";
import { LoadingState } from "../shared/LoadingState";
import { ThemeToggle } from "../shared/ThemeToggle";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

const POSITION_COLORS: Record<string, string> = {
  GK: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  DEF: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  MID: "text-green-400 bg-green-400/10 border-green-400/30",
  ATT: "text-red-400 bg-red-400/10 border-red-400/30",
  FWD: "text-red-400 bg-red-400/10 border-red-400/30",
};

function PlayerRowItem({ player, status }: { player: Player; status: "SOLD" | "UNSOLD" }) {
  const positions = player.position?.split(/[\s,\/]+/).filter(Boolean) || ["N/A"];
  const pos1 = positions[0];
  const pos2 = positions[1];

  const pos1Class = POSITION_COLORS[pos1?.toUpperCase()] ?? "text-slate-400 bg-slate-400/10 border-slate-400/30";
  const pos2Class = pos2 ? (POSITION_COLORS[pos2.toUpperCase()] ?? "text-slate-400 bg-slate-400/10 border-slate-400/30") : null;

  return (
    <Dialog>
      <DialogTrigger className="w-full text-left outline-none cursor-pointer">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-pitch-900/40 border border-slate-800/40 hover:border-slate-700/80 hover:bg-pitch-900/80 transition-all duration-200 group">
          {/* Avatar placeholder / initials */}
          <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-300 flex-shrink-0 group-hover:border-slate-600 transition-colors overflow-hidden">
            {player.imageUrl ? (
              <img src={player.imageUrl} alt={player.name} className="w-full h-full object-cover" />
            ) : (
              player.name.slice(0, 2).toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-lg text-slate-100 truncate leading-tight mb-1">{player.name}</p>
            <p className="text-[10px] text-slate-500 truncate uppercase tracking-widest">
              {status === "SOLD" && player.team ? player.team.name : "Base"}
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-4">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border",
                pos1Class,
              )}
            >
              {pos1}
            </span>
          </div>

          <div className="text-right flex-shrink-0 min-w-[80px]">
            {status === "SOLD" ? (
              <span className="font-mono text-base text-accent-gold font-bold drop-shadow">
                ₹{player.transactionAmount}
              </span>
            ) : (
              <span className="font-mono text-base text-slate-300 font-medium">₹{player.basePrice}</span>
            )}
          </div>
        </div>
      </DialogTrigger>

      <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-lg sm:max-w-xl w-full" showCloseButton={false}>
        <div className="flex flex-col p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl relative overflow-hidden">
          {/* Decorative background */}
          <div className="absolute top-[-30%] left-[-20%] w-[100%] h-[100%] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="flex flex-col items-center gap-4 mb-4 relative z-10 text-center">
            {/* Big Profile Picture */}
            <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-slate-800 border-[8px] border-slate-800 flex items-center justify-center text-8xl font-black text-slate-400 flex-shrink-0 shadow-[0_0_50px_-5px_rgba(0,0,0,0.6)] overflow-hidden relative">
              {player.imageUrl ? (
                <img src={player.imageUrl} alt={player.name} className="w-full h-full object-cover" />
              ) : (
                player.name.slice(0, 2).toUpperCase()
              )}
            </div>

            {/* Main Info */}
            <div className="w-full px-2 mt-2">
              <h3 className="text-3xl sm:text-4xl font-heading font-bold text-white leading-tight mb-4 drop-shadow-md">{player.name}</h3>
              
              <div className="flex flex-col items-center gap-3">
                <div className="flex justify-center items-center gap-3">
                  <span className="text-sm font-black text-slate-500 tracking-widest w-8 text-right">P1</span>
                  <span className={cn("text-xs sm:text-sm font-bold uppercase tracking-widest px-5 py-1.5 rounded-lg border min-w-[90px] text-center", pos1Class)}>
                    {pos1}
                  </span>
                </div>
                <div className="flex justify-center items-center gap-3">
                  <span className="text-sm font-black text-slate-500 tracking-widest w-8 text-right">P2</span>
                  <span className={cn("text-xs sm:text-sm font-bold uppercase tracking-widest px-5 py-1.5 rounded-lg border min-w-[90px] text-center", pos2Class || "text-slate-600 bg-slate-800/30 border-slate-700/50")}>
                    {pos2 || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom Info Grid */}
          <div className="pt-5 border-t border-slate-800 w-full relative z-10 grid grid-cols-2 gap-6 bg-slate-900/50 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 px-6 sm:px-8 pb-6 sm:pb-8 rounded-b-3xl mt-6">
            {status === "SOLD" ? (
              <>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Team</p>
                  <p className="font-bold text-xl text-slate-200" title={player.team?.name}>{player.team?.name || player.team?.shortCode || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Sold For</p>
                  <p className="font-mono font-bold text-2xl sm:text-3xl text-accent-gold drop-shadow-md">₹{player.transactionAmount}</p>
                </div>
              </>
            ) : (
              <div className="col-span-2 text-center">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1.5 font-bold">Base Price</p>
                <p className="font-mono font-black text-4xl text-slate-100">₹{player.basePrice}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PlayerListView({ status }: { status: "SOLD" | "UNSOLD" }) {
  const { data: players, isLoading } = usePlayers(status);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!players) return [];
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.position?.toLowerCase().includes(q) ||
        p.team?.shortCode?.toLowerCase().includes(q) ||
        p.team?.name?.toLowerCase().includes(q),
    );
  }, [players, query]);

  const isSold = status === "SOLD";
  const title = isSold ? "Sold Players" : "Unsold Players";
  const accentClass = isSold ? "text-accent-gold" : "text-slate-400";

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-8 md:px-12 relative">
      {/* Background blobs */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-4xl flex flex-col gap-6 relative z-10">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <Link
            href={ROUTES.DASHBOARD}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <ThemeToggle />
        </div>

        {/* Title */}
        <div>
          <h1 className={cn("text-4xl md:text-5xl font-bold uppercase tracking-wide font-heading", accentClass)}>
            {title}
          </h1>
          {players && (
            <p className="text-slate-500 text-sm mt-1 font-mono">
              {filtered.length}{query ? ` of ${players.length}` : ""} players
            </p>
          )}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()} by name, position, or team…`}
            className="w-full h-12 pl-11 pr-10 rounded-xl bg-pitch-900/60 border border-slate-700/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-slate-500 focus:bg-pitch-900/80 transition-all"
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

        {/* List */}
        {isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <p className="text-lg">{query ? "No players match your search." : `No ${status.toLowerCase()} players yet.`}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((player) => (
              <PlayerRowItem key={player.id} player={player} status={status} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
