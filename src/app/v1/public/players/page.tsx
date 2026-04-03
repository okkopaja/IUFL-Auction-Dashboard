"use client";

import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import { UIEvent, useMemo, useState } from "react";
import {
  PlayerDetailsDialog,
  PlayerRowItem,
} from "@/components/dashboard/PlayerListView";
import { LoadingState } from "@/components/shared/LoadingState";
import { usePlayers } from "@/hooks/useAuction";
import { TRIAL_ABSENTEE_PLAYERS } from "@/lib/absenteePlayers";
import { ROUTES } from "@/lib/constants";
import {
  filterPlayersByPositionGroup,
  filterPlayersBySearch,
} from "@/lib/playerFilters";
import { cn } from "@/lib/utils";

export default function PlayersPage() {
  const PLAYERS_PAGE_SIZE = 15;
  const { data: players = [], isLoading } = usePlayers();
  const [allPlayersQuery, setAllPlayersQuery] = useState("");
  const [isUnsoldAbsenteesOpen, setIsUnsoldAbsenteesOpen] = useState(false);
  const [viewOnlyQuery, setViewOnlyQuery] = useState("");
  const [allPlayersVisibleCount, setAllPlayersVisibleCount] =
    useState(PLAYERS_PAGE_SIZE);
  const [selectedAllPlayer, setSelectedAllPlayer] = useState<
    (typeof players)[number] | null
  >(null);

  const groupedPlayers = useMemo(
    () => ({
      gk: filterPlayersByPositionGroup(players, "GK"),
      defence: filterPlayersByPositionGroup(players, "DEFENCE"),
      midfielder: filterPlayersByPositionGroup(players, "MIDFIELDER"),
      attacker: filterPlayersByPositionGroup(players, "ATTACKER"),
    }),
    [players],
  );

  const filteredAllPlayers = useMemo(
    () => filterPlayersBySearch(players, allPlayersQuery),
    [players, allPlayersQuery],
  );

  const visibleAllPlayers = useMemo(
    () => filteredAllPlayers.slice(0, allPlayersVisibleCount),
    [filteredAllPlayers, allPlayersVisibleCount],
  );

  const hasMoreAllPlayers =
    visibleAllPlayers.length < filteredAllPlayers.length;

  const unsoldPlayers = useMemo(
    () => players.filter((player) => player.status === "UNSOLD"),
    [players],
  );

  const normalizedViewOnlyQuery = viewOnlyQuery.trim().toLowerCase();

  const filteredUnsoldPlayers = useMemo(() => {
    if (!normalizedViewOnlyQuery) return unsoldPlayers;

    return unsoldPlayers.filter((player) => {
      const searchableText = [
        player.name,
        player.position1,
        player.position2 ?? "",
        player.year ?? "",
        player.stream ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedViewOnlyQuery);
    });
  }, [unsoldPlayers, normalizedViewOnlyQuery]);

  const filteredAbsentees = useMemo(() => {
    if (!normalizedViewOnlyQuery) return TRIAL_ABSENTEE_PLAYERS;

    return TRIAL_ABSENTEE_PLAYERS.filter((name) =>
      name.toLowerCase().includes(normalizedViewOnlyQuery),
    );
  }, [normalizedViewOnlyQuery]);

  const positionCards = [
    {
      title: "GK",
      subtitle: "Goalkeepers",
      href: ROUTES.PLAYERS_GK,
      count: groupedPlayers.gk.length,
    },
    {
      title: "Defence",
      subtitle: "Defenders",
      href: ROUTES.PLAYERS_DEFENCE,
      count: groupedPlayers.defence.length,
    },
    {
      title: "Midfielder",
      subtitle: "Midfield",
      href: ROUTES.PLAYERS_MIDFIELDER,
      count: groupedPlayers.midfielder.length,
    },
    {
      title: "Attacker",
      subtitle: "Forward Line",
      href: ROUTES.PLAYERS_ATTACKER,
      count: groupedPlayers.attacker.length,
    },
  ];

  const hasAllPlayersQuery = allPlayersQuery.trim().length > 0;
  const hasViewOnlyQuery = normalizedViewOnlyQuery.length > 0;

  const handleAllPlayersQueryChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setAllPlayersQuery(event.target.value);
    setAllPlayersVisibleCount(PLAYERS_PAGE_SIZE);
    setSelectedAllPlayer(null);
  };

  const handleClearAllPlayersQuery = () => {
    setAllPlayersQuery("");
    setAllPlayersVisibleCount(PLAYERS_PAGE_SIZE);
    setSelectedAllPlayer(null);
  };

  const handleAllPlayersScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const nearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 80;

    if (!nearBottom || !hasMoreAllPlayers) return;

    setAllPlayersVisibleCount((currentCount) =>
      Math.min(currentCount + PLAYERS_PAGE_SIZE, filteredAllPlayers.length),
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-8 md:px-12 relative bg-pitch-950 text-white">
      {/* Background blobs */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-4xl flex flex-col gap-6 relative z-10">
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
            Players
          </h1>
          {!isLoading && (
            <p className="text-slate-500 text-sm mt-1 font-mono">
              {players.length} total players available
            </p>
          )}
        </div>

        {isLoading ? (
          <LoadingState />
        ) : (
          <div className="flex flex-col gap-6">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {positionCards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group rounded-2xl border border-slate-700/70 bg-slate-900/40 px-6 py-8 transition-all hover:border-[#ccff00]/60 hover:bg-slate-900/70"
                >
                  <p className="text-slate-500 text-[11px] font-mono uppercase tracking-widest">
                    {card.count} players
                  </p>
                  <h2 className="mt-2 text-2xl font-heading font-bold uppercase tracking-wide text-white group-hover:text-[#ccff00] transition-colors">
                    {card.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">{card.subtitle}</p>
                </Link>
              ))}
            </section>

            <section className="rounded-2xl border border-slate-700/70 bg-slate-900/45 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setIsUnsoldAbsenteesOpen((prev) => !prev)}
                className="group flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-6"
                aria-expanded={isUnsoldAbsenteesOpen}
              >
                <div>
                  <p className="text-slate-500 text-[11px] font-mono uppercase tracking-widest">
                    View only list
                  </p>
                  <h2 className="mt-2 text-2xl font-heading font-bold uppercase tracking-wide text-white transition-colors group-hover:text-[#ccff00]">
                    Unsold &amp; Absentees
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {unsoldPlayers.length} unsold •{" "}
                    {TRIAL_ABSENTEE_PLAYERS.length} absentees
                  </p>
                </div>

                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-slate-400 transition-all",
                    isUnsoldAbsenteesOpen && "rotate-180 text-[#ccff00]",
                  )}
                />
              </button>

              {isUnsoldAbsenteesOpen && (
                <div className="border-t border-slate-800/70 px-5 pb-5 md:px-6 md:pb-6">
                  <div className="relative mt-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={viewOnlyQuery}
                      onChange={(e) => setViewOnlyQuery(e.target.value)}
                      placeholder="Search unsold and absentee players..."
                      className="h-11 w-full rounded-xl border border-slate-700/60 bg-slate-950/60 pl-11 pr-10 text-sm text-slate-100 placeholder-slate-600 font-mono transition-all focus:border-[#ccff00]/50 focus:bg-slate-900/80 focus:outline-none"
                    />
                    {viewOnlyQuery && (
                      <button
                        type="button"
                        onClick={() => setViewOnlyQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                        aria-label="Clear unsold and absentee search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <section className="rounded-xl border border-slate-800/80 bg-slate-950/35 p-4">
                      <div className="flex items-end justify-between gap-3">
                        <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-white">
                          Unsold
                        </h3>
                        <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">
                          {filteredUnsoldPlayers.length}
                          {hasViewOnlyQuery
                            ? ` of ${unsoldPlayers.length}`
                            : ""}
                        </p>
                      </div>

                      <div className="mt-3 max-h-72 overflow-y-auto pr-1">
                        {filteredUnsoldPlayers.length === 0 ? (
                          <p className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3 text-xs text-slate-500">
                            {hasViewOnlyQuery
                              ? "No unsold players match your search."
                              : "No unsold players available."}
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {filteredUnsoldPlayers.map((player) => (
                              <li
                                key={player.id}
                                className="rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2"
                              >
                                <p className="text-sm font-semibold text-slate-100">
                                  {player.name}
                                </p>
                                <p className="mt-1 text-[11px] font-mono uppercase tracking-wide text-slate-400">
                                  {[
                                    [player.position1, player.position2]
                                      .filter(Boolean)
                                      .join(" / "),
                                    player.year,
                                    `${player.basePrice} pts`,
                                  ]
                                    .filter(Boolean)
                                    .join(" • ")}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </section>

                    <section className="rounded-xl border border-slate-800/80 bg-slate-950/35 p-4">
                      <div className="flex items-end justify-between gap-3">
                        <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-white">
                          Absentees
                        </h3>
                        <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">
                          {filteredAbsentees.length}
                          {hasViewOnlyQuery
                            ? ` of ${TRIAL_ABSENTEE_PLAYERS.length}`
                            : ""}
                        </p>
                      </div>

                      <div className="mt-3 max-h-72 overflow-y-auto pr-1">
                        {filteredAbsentees.length === 0 ? (
                          <p className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3 text-xs text-slate-500">
                            No absentees match your search.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {filteredAbsentees.map((name) => (
                              <li
                                key={name}
                                className="rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2"
                              >
                                <p className="text-sm font-semibold text-slate-100">
                                  {name}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800/70 bg-slate-900/45 p-5 md:p-6 backdrop-blur-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide font-heading text-white">
                  All Players
                </h2>
                <p className="text-slate-500 text-xs md:text-sm font-mono uppercase tracking-widest">
                  {filteredAllPlayers.length}
                  {hasAllPlayersQuery ? ` of ${players.length}` : ""} players
                </p>
              </div>

              <div className="relative mt-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={allPlayersQuery}
                  onChange={handleAllPlayersQueryChange}
                  placeholder="Global search by name, position, or team..."
                  className="w-full h-11 pl-11 pr-10 rounded-xl bg-slate-950/60 border border-slate-700/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-[#ccff00]/50 focus:bg-slate-900/80 transition-all font-mono"
                />
                {allPlayersQuery && (
                  <button
                    type="button"
                    onClick={handleClearAllPlayersQuery}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label="Clear global search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="mt-4">
                {filteredAllPlayers.length === 0 ? (
                  <div className="text-center py-10 text-slate-600 font-mono">
                    <p className="text-sm md:text-base">
                      {hasAllPlayersQuery
                        ? "No players match your global search."
                        : "No players configured yet."}
                    </p>
                  </div>
                ) : (
                  <div
                    className="max-h-[70vh] overflow-y-auto overscroll-contain pr-1"
                    onScroll={handleAllPlayersScroll}
                  >
                    <div className="flex flex-col gap-3">
                      {visibleAllPlayers.map((player) => (
                        <PlayerRowItem
                          key={player.id}
                          player={player}
                          status="ALL"
                          onSelect={setSelectedAllPlayer}
                        />
                      ))}
                    </div>

                    {hasMoreAllPlayers ? (
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
            </section>
          </div>
        )}
      </div>

      <PlayerDetailsDialog
        player={selectedAllPlayer}
        status="ALL"
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAllPlayer(null);
          }
        }}
      />
    </div>
  );
}
