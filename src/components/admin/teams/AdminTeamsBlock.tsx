"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Shield } from "lucide-react";
import type { Team } from "@/types";

function fetchTeams() {
  return fetch("/api/teams").then(res => res.json());
}

export function AdminTeamsBlock() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: fetchTeams,
  });

  const teams: Team[] = data?.data || [];

  return (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        <div className="flex justify-center py-8">
           <Loader2 className="size-5 text-accent-gold animate-spin" />
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">
          No teams available
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {teams.map((team) => (
            <div
              key={team.id}
              className="p-4 rounded-xl border border-slate-800 bg-pitch-800/30 hover:bg-slate-800/50 transition-colors flex flex-col gap-4 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-slate-800/80 border border-slate-700 group-hover:border-slate-500 transition-colors flex items-center justify-center">
                    <Shield className="size-5 text-slate-400" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-100 text-sm tracking-wide">{team.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{team.domain}</div>
                  </div>
                </div>
                <div className="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  {team.shortCode}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="bg-pitch-950/80 rounded-lg p-3 border border-slate-800/50 text-center shadow-inner">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">Funds</p>
                  <p className="text-sm font-mono font-bold text-accent-gold tracking-tight">
                    {team.pointsRemaining.toLocaleString()}
                  </p>
                </div>
                <div className="bg-pitch-950/80 rounded-lg p-3 border border-slate-800/50 text-center shadow-inner flex flex-col items-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">Squad</p>
                  <p className="text-sm font-mono font-bold text-slate-300">
                    <span className="text-slate-100">{team.playersOwnedCount}</span><span className="text-slate-600 ml-1 opacity-70">/ 18</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
