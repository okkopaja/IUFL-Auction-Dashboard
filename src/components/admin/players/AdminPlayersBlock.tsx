"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, User } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toDisplayImageUrl } from "@/lib/imageUrl";
import type { Player } from "@/types";

function fetchAllPlayers() {
  return fetch("/api/players").then((res) => res.json());
}

function formatSoldAmount(amount: number | null | undefined): string {
  return typeof amount === "number" ? `${amount.toLocaleString()} pts` : "-";
}

export function AdminPlayersBlock() {
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-players"],
    queryFn: fetchAllPlayers,
  });

  const players: Player[] = data?.data || [];
  const selectedPlayerImageUrl = toDisplayImageUrl(selectedPlayer?.imageUrl);

  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by player name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-pitch-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all font-mono"
        />
      </div>

      {/* Results */}
      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 text-accent-gold animate-spin" />
          </div>
        ) : (
          filteredPlayers.map((player) => {
            const playerImageUrl = toDisplayImageUrl(player.imageUrl);

            return (
              <button
                type="button"
                key={player.id}
                onClick={() => setSelectedPlayer(player)}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-pitch-800/30 hover:bg-slate-800/80 hover:border-slate-600 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  {playerImageUrl ? (
                    <img
                      src={playerImageUrl}
                      alt={player.name}
                      className="size-10 object-cover rounded-full bg-pitch-950 border border-slate-700 group-hover:border-slate-500 transition-colors"
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 group-hover:border-slate-500 transition-colors">
                      <User className="size-5 text-slate-500" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-slate-200 text-sm">
                      {player.name}
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {player.position1}{" "}
                      {player.position2 && ` • ${player.position2}`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-xs font-mono font-bold ${
                      player.status === "SOLD"
                        ? "text-accent-green"
                        : player.status === "UNSOLD"
                          ? "text-slate-500"
                          : "text-accent-gold"
                    }`}
                  >
                    {player.status}
                  </div>
                  {player.status === "SOLD" &&
                    player.transactionAmount !== null &&
                    player.transactionAmount !== undefined && (
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {formatSoldAmount(player.transactionAmount)}
                      </div>
                    )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Player Detail Modal */}
      <Dialog
        open={!!selectedPlayer}
        onOpenChange={(open) => !open && setSelectedPlayer(null)}
      >
        <DialogContent className="max-w-md bg-pitch-900 border-slate-800 text-slate-200 p-0 overflow-hidden sm:rounded-2xl shadow-2xl">
          {selectedPlayer && (
            <div className="flex flex-col">
              {/* Header Image */}
              <div className="relative w-full h-72 bg-pitch-950 border-b border-slate-800 flex items-center justify-center overflow-hidden">
                {selectedPlayerImageUrl ? (
                  <img
                    src={selectedPlayerImageUrl}
                    alt={selectedPlayer.name}
                    className="w-full h-full object-cover opacity-90 transition-transform duration-700 hover:scale-105"
                  />
                ) : (
                  <User className="size-24 text-slate-700" />
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-pitch-900 via-pitch-900/80 to-transparent" />

                {/* Status Badge */}
                <div className="absolute top-4 left-4 flex gap-2">
                  <div
                    className={`px-3 py-1.5 rounded-md border text-xs font-bold tracking-widest uppercase shadow-sm backdrop-blur-md ${
                      selectedPlayer.status === "SOLD"
                        ? "bg-accent-green/20 text-accent-green border-accent-green/30"
                        : selectedPlayer.status === "UNSOLD"
                          ? "bg-slate-800/80 text-slate-400 border-slate-700"
                          : "bg-accent-gold/20 text-accent-gold border-accent-gold/30"
                    }`}
                  >
                    {selectedPlayer.status}
                  </div>
                </div>
              </div>

              {/* Player Details */}
              <div className="p-6 pt-0 flex flex-col gap-6 relative z-10 -mt-8">
                <div>
                  <h2 className="text-3xl font-bold font-heading text-slate-100">
                    {selectedPlayer.name}
                  </h2>
                  <p className="text-sm text-accent-gold mt-1 font-medium tracking-wide">
                    {selectedPlayer.position1}{" "}
                    {selectedPlayer.position2 &&
                      ` • ${selectedPlayer.position2}`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-pitch-950/50 rounded-xl p-4 border border-slate-800/50 flex flex-col justify-center">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                      Base Price
                    </p>
                    <p className="text-xl font-mono font-bold text-slate-200">
                      {selectedPlayer.basePrice.toLocaleString()}
                    </p>
                  </div>
                  {selectedPlayer.transactionAmount !== null &&
                  selectedPlayer.transactionAmount !== undefined ? (
                    <div className="bg-pitch-950/50 rounded-xl p-4 border border-slate-800/50 flex flex-col justify-center">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                        Sold For
                      </p>
                      <p className="text-xl font-mono font-bold text-accent-green">
                        {formatSoldAmount(selectedPlayer.transactionAmount)}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-pitch-950/50 rounded-xl p-4 border border-slate-800/50 flex flex-col justify-center">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                        Status
                      </p>
                      <p className="text-lg font-mono font-bold text-slate-400">
                        {selectedPlayer.status === "UNSOLD"
                          ? "Unsold"
                          : "In Auction"}
                      </p>
                    </div>
                  )}
                  {selectedPlayer.teamId && selectedPlayer.team ? (
                    <div className="bg-pitch-950/50 rounded-xl p-4 border border-slate-800/50 col-span-2 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                          Team Details
                        </p>
                        <p className="font-medium text-slate-100">
                          {selectedPlayer.team.name}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-bold tracking-widest bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg shadow-inner">
                        {selectedPlayer.team.shortCode}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
