"use client";

import { ArrowLeft, Search, X } from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, type UIEvent, useMemo, useState } from "react";
import {
  PlayerDetailsDialog,
  PlayerRowItem,
} from "@/components/dashboard/PlayerListView";
import { LoadingState } from "@/components/shared/LoadingState";
import { usePlayers } from "@/hooks/useAuction";
import { ROUTES } from "@/lib/constants";
import {
  filterPlayersByPositionGroup,
  filterPlayersBySearch,
  type PositionGroup,
} from "@/lib/playerFilters";

type PositionPlayersViewProps = {
  group: PositionGroup;
  title: string;
};

export function PositionPlayersView({
  group,
  title,
}: PositionPlayersViewProps) {
  const PAGE_SIZE = 15;
  const { data: players = [], isLoading } = usePlayers();
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedPlayer, setSelectedPlayer] = useState<
    (typeof players)[number] | null
  >(null);

  const groupedPlayers = useMemo(
    () => filterPlayersByPositionGroup(players, group),
    [players, group],
  );

  const filteredPlayers = useMemo(
    () => filterPlayersBySearch(groupedPlayers, query),
    [groupedPlayers, query],
  );

  const visiblePlayers = useMemo(
    () => filteredPlayers.slice(0, visibleCount),
    [filteredPlayers, visibleCount],
  );

  const hasMorePlayers = visiblePlayers.length < filteredPlayers.length;

  const hasQuery = query.trim().length > 0;

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setVisibleCount(PAGE_SIZE);
    setSelectedPlayer(null);
  };

  const handleClearQuery = () => {
    setQuery("");
    setVisibleCount(PAGE_SIZE);
    setSelectedPlayer(null);
  };

  const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const nearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 80;

    if (!nearBottom || !hasMorePlayers) return;

    setVisibleCount((currentCount) =>
      Math.min(currentCount + PAGE_SIZE, filteredPlayers.length),
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-8 md:px-12 relative bg-pitch-950 text-white">
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-4xl flex flex-col gap-6 relative z-10">
        <div className="flex items-center justify-between">
          <Link
            href={ROUTES.PLAYERS}
            className="flex items-center gap-2 text-slate-400 hover:text-[#ccff00] transition-colors text-sm font-medium font-mono uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" />
            Players
          </Link>
        </div>

        <div>
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-wide font-heading text-white">
            {title}
          </h1>
          {!isLoading && (
            <p className="text-slate-500 text-sm mt-1 font-mono">
              {filteredPlayers.length}
              {hasQuery ? ` of ${groupedPlayers.length}` : ""} players
            </p>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder={`Search ${title.toLowerCase()} by name, position, or team...`}
            className="w-full h-11 pl-11 pr-10 rounded-xl bg-slate-950/60 border border-slate-700/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-[#ccff00]/50 focus:bg-slate-900/80 transition-all font-mono"
          />
          {query && (
            <button
              type="button"
              onClick={handleClearQuery}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label={`Clear ${title} search`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isLoading ? (
          <LoadingState />
        ) : filteredPlayers.length === 0 ? (
          <div className="text-center py-20 text-slate-600 font-mono">
            <p className="text-lg">
              {hasQuery
                ? "No players match your search."
                : `No players available in ${title}.`}
            </p>
          </div>
        ) : (
          <div
            className="max-h-[70vh] overflow-y-auto overscroll-contain pr-1"
            onScroll={handleListScroll}
          >
            <div className="flex flex-col gap-3">
              {visiblePlayers.map((player) => (
                <PlayerRowItem
                  key={player.id}
                  player={player}
                  status="ALL"
                  onSelect={setSelectedPlayer}
                />
              ))}
            </div>

            {hasMorePlayers ? (
              <p className="pt-4 pb-1 text-center text-[11px] font-mono uppercase tracking-widest text-slate-500">
                Scroll to load more
              </p>
            ) : (
              <p className="pt-4 pb-1 text-center text-[11px] font-mono uppercase tracking-widest text-slate-600">
                End of list
              </p>
            )}
          </div>
        )}
      </div>

      <PlayerDetailsDialog
        player={selectedPlayer}
        status="ALL"
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPlayer(null);
          }
        }}
      />
    </div>
  );
}
