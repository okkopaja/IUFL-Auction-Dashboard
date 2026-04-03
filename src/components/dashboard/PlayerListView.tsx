"use client";

import { ArrowLeft, Search, X } from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, type UIEvent, memo, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usePlayers } from "@/hooks/useAuction";
import { ROUTES } from "@/lib/constants";
import { toDisplayImageUrl } from "@/lib/imageUrl";
import { cn } from "@/lib/utils";
import type { Player } from "@/types";
import { LoadingState } from "../shared/LoadingState";

type PlayerListStatus = "SOLD" | "UNSOLD" | "ALL";

const POSITION_COLORS: Record<string, string> = {
  GK: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  DEF: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  MID: "text-green-400 bg-green-400/10 border-green-400/30",
  ATT: "text-red-400 bg-red-400/10 border-red-400/30",
  FWD: "text-red-400 bg-red-400/10 border-red-400/30",
};

function formatSoldAmount(amount: number | null | undefined): string {
  return typeof amount === "number" ? `${amount} pts` : "-";
}

function isSoldStatus(player: Player, status: PlayerListStatus) {
  return status === "SOLD" || (status === "ALL" && !!player.teamId);
}

type PlayerRowItemProps = {
  player: Player;
  status: PlayerListStatus;
  onSelect?: (player: Player) => void;
};

export const PlayerRowItem = memo(function PlayerRowItem({
  player,
  status,
  onSelect,
}: PlayerRowItemProps) {
  const pos1 = player.position1;
  const pos1Class =
    POSITION_COLORS[pos1?.toUpperCase()] ??
    "text-slate-400 bg-slate-400/10 border-slate-400/30";
  const soldStatus = isSoldStatus(player, status);
  const playerImageUrl = toDisplayImageUrl(player.imageUrl);

  const rowContent = (
    <div
      className="flex items-center gap-4 p-4 rounded-xl bg-pitch-950/40 border border-slate-800/60 hover:border-slate-700/80 hover:bg-slate-800/30 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 group relative overflow-hidden cursor-pointer"
      style={{ contentVisibility: "auto", containIntrinsicSize: "80px" }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-accent-gold/0 via-accent-gold/5 to-accent-gold/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />

      <div className="relative size-12 shrink-0">
        <div className="absolute inset-0 bg-accent-gold/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <div className="relative w-full h-full rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-300 overflow-hidden shadow-md group-hover:border-slate-500 transition-colors z-10">
          {playerImageUrl ? (
            <img
              src={playerImageUrl}
              alt={player.name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              width={48}
              height={48}
            />
          ) : (
            player.name.slice(0, 2).toUpperCase()
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col items-start z-10">
        <p className="font-bold text-lg text-slate-100 truncate leading-tight mb-1 max-w-full drop-shadow-sm group-hover:text-white transition-colors">
          {player.name}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 truncate uppercase tracking-widest">
            {soldStatus && player.team ? player.team.name : "Base"}
          </span>
          {player.year && (
            <span className="text-[10px] text-slate-500 truncate uppercase tracking-widest">
              {player.year}
            </span>
          )}
          <span
            className={cn(
              "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border sm:hidden",
              pos1Class,
            )}
          >
            {pos1}
          </span>
        </div>
      </div>

      <div className="hidden sm:flex items-center justify-end min-w-[70px] z-10">
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded border shadow-sm",
            pos1Class,
          )}
        >
          {pos1}
        </span>
      </div>

      <div className="text-right shrink-0 min-w-20 z-10 flex flex-col justify-center">
        {soldStatus ? (
          <span className="font-mono text-base text-accent-gold font-bold drop-shadow">
            {formatSoldAmount(player.transactionAmount)}
          </span>
        ) : (
          <span className="font-mono text-base text-slate-300 font-medium">
            {player.basePrice} pts
          </span>
        )}
      </div>
    </div>
  );

  if (!onSelect) {
    return rowContent;
  }

  return (
    <button
      type="button"
      className="w-full text-left outline-none cursor-pointer"
      onClick={() => onSelect(player)}
      aria-label={`View details for ${player.name}`}
    >
      {rowContent}
    </button>
  );
});

PlayerRowItem.displayName = "PlayerRowItem";

export function PlayerDetailsDialog({
  player,
  status,
  onOpenChange,
}: {
  player: Player | null;
  status: PlayerListStatus;
  onOpenChange: (open: boolean) => void;
}) {
  if (!player) {
    return null;
  }

  const pos1 = player.position1;
  const pos2 = player.position2;

  const pos1Class =
    POSITION_COLORS[pos1?.toUpperCase()] ??
    "text-slate-400 bg-slate-400/10 border-slate-400/30";
  const pos2Class = pos2
    ? (POSITION_COLORS[pos2.toUpperCase()] ??
      "text-slate-400 bg-slate-400/10 border-slate-400/30")
    : null;

  const soldStatus = isSoldStatus(player, status);
  const playerImageUrl = toDisplayImageUrl(player.imageUrl);

  return (
    <Dialog open={!!player} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 border-none bg-transparent shadow-none min-w-0 max-w-md border-0 ring-0 focus:outline-none sm:max-w-lg md:max-w-xl"
        showCloseButton={false}
      >
        <div className="relative w-full overflow-hidden rounded-3xl border border-slate-700 bg-pitch-950 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col z-10 max-h-[90vh] focus-visible:outline-none">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 z-20 rounded-full bg-black/40 p-2 text-white/70 hover:bg-black/80 hover:text-white transition-all backdrop-blur-md"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="w-full relative flex-1 flex items-center justify-center bg-slate-900/50 min-h-[40vh] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-transparent to-transparent z-10 pointer-events-none" />
            {playerImageUrl ? (
              <img
                src={playerImageUrl}
                alt={player.name}
                className="w-full h-full object-contain max-h-[60vh]"
                decoding="async"
              />
            ) : (
              <div className="text-6xl sm:text-8xl font-black text-slate-700 h-[40vh] flex items-center justify-center">
                {player.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <div className="w-full p-6 pt-0 shrink-0 bg-pitch-950 flex flex-col items-center gap-2 text-center relative z-20">
            <p className="text-[10px] text-accent-gold uppercase tracking-[0.3em] font-black mb-1">
              Player Profile
            </p>
            <div className="h-px w-12 bg-accent-gold/30 mb-2 rounded-full" />
            <h3 className="text-2xl md:text-3xl font-black font-heading tracking-wider uppercase text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              {player.name}
            </h3>

            <div className="flex flex-wrap justify-center gap-2 mt-2 w-full">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border",
                  pos1Class,
                )}
              >
                {pos1}
              </span>
              {pos2 && (
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border",
                    pos2Class,
                  )}
                >
                  {pos2}
                </span>
              )}
              <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border text-slate-300 bg-slate-800/30 border-slate-700/50">
                {player.stream || "N/A"}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border text-slate-300 bg-slate-800/30 border-slate-700/50">
                {player.year || "N/A"}
              </span>
            </div>
          </div>

          {/* Bottom Info Grid */}
          <div className="border-t border-slate-800/50 w-full relative z-20 shrink-0 grid grid-cols-2 gap-4 bg-slate-900/30 px-6 py-5 pb-6">
            {soldStatus ? (
              <>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">
                    Team
                  </p>
                  <p
                    className="font-bold text-lg text-slate-200 truncate"
                    title={player.team?.name}
                  >
                    {player.team?.name || player.team?.shortCode || "—"}
                  </p>
                </div>
                <div className="text-center border-l border-slate-800/50 pl-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">
                    Sold For
                  </p>
                  <p className="font-mono font-bold text-xl sm:text-2xl text-accent-gold drop-shadow-md">
                    {formatSoldAmount(player.transactionAmount)}
                  </p>
                </div>
              </>
            ) : (
              <div className="col-span-2 text-center">
                <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest mb-1.5 font-bold">
                  Base Price
                </p>
                <p className="font-mono font-black text-3xl text-slate-100">
                  {player.basePrice} pts
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PlayerListView({ status }: { status: "SOLD" | "UNSOLD" }) {
  const PAGE_SIZE = 15;
  const { data: players, isLoading } = usePlayers(status);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const filtered = useMemo(() => {
    if (!players) return [];
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.position1?.toLowerCase().includes(q) ||
        p.position2?.toLowerCase().includes(q) ||
        p.year?.toLowerCase().includes(q) ||
        p.stream?.toLowerCase().includes(q) ||
        p.team?.shortCode?.toLowerCase().includes(q) ||
        p.team?.name?.toLowerCase().includes(q),
    );
  }, [players, query]);

  const visiblePlayers = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const hasMorePlayers = visiblePlayers.length < filtered.length;

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
      Math.min(currentCount + PAGE_SIZE, filtered.length),
    );
  };

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
            href={ROUTES.PLAYERS}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Players
          </Link>
        </div>

        {/* Title */}
        <div>
          <h1
            className={cn(
              "text-4xl md:text-5xl font-bold uppercase tracking-wide font-heading",
              accentClass,
            )}
          >
            {title}
          </h1>
          {players && (
            <p className="text-slate-500 text-sm mt-1 font-mono">
              {filtered.length}
              {query ? ` of ${players.length}` : ""} players
            </p>
          )}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder={`Search ${title.toLowerCase()} by name, position, or team…`}
            className="w-full h-12 pl-11 pr-10 rounded-xl bg-pitch-900/60 border border-slate-700/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-slate-500 focus:bg-pitch-900/80 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={handleClearQuery}
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
            <p className="text-lg">
              {query
                ? "No players match your search."
                : `No ${status.toLowerCase()} players yet.`}
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
                  status={status}
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
        status={status}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPlayer(null);
          }
        }}
      />
    </div>
  );
}
