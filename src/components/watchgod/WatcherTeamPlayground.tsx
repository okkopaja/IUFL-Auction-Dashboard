"use client";

import {
  ArrowLeft,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Undo2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  useWatcherTeamPlaygroundSnapshot,
  type WatcherTeamLivePlayer,
} from "@/hooks/useWatchgod";
import { calculateTeamBidConstraints } from "@/lib/bidConstraints";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { Button } from "../ui/button";

const STORAGE_KEY = "watchgod-scp-playground-v1";
const WATCHER_TEAM_POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;
const WATCHER_TEAM_POSITION_SET = new Set(WATCHER_TEAM_POSITIONS);

interface LocalAddedPlayer {
  id: string;
  name: string;
  position1: string;
  amount: number;
  createdAt: string;
}

interface LocalPlaygroundState {
  addedPlayers: LocalAddedPlayer[];
  removedLivePlayerIds: string[];
}

function formatCategoryLabel(position: string | null | undefined) {
  if (!position) return "Unspecified";

  const canonicalPosition = position.trim().toUpperCase();
  if (
    WATCHER_TEAM_POSITION_SET.has(
      canonicalPosition as (typeof WATCHER_TEAM_POSITIONS)[number],
    )
  ) {
    return canonicalPosition;
  }

  return position
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function createLocalPlayerId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseLocalPlaygroundState(raw: string | null): LocalPlaygroundState {
  if (!raw) {
    return {
      addedPlayers: [],
      removedLivePlayerIds: [],
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalPlaygroundState>;
    const addedPlayers = Array.isArray(parsed.addedPlayers)
      ? parsed.addedPlayers
          .filter(
            (player) =>
              player &&
              typeof player.id === "string" &&
              typeof player.name === "string" &&
              typeof player.position1 === "string" &&
              typeof player.amount === "number" &&
              Number.isFinite(player.amount),
          )
          .map((player) => ({
            id: player.id,
            name: player.name,
            position1: player.position1,
            amount: Math.max(1, Math.trunc(player.amount)),
            createdAt:
              typeof player.createdAt === "string"
                ? player.createdAt
                : new Date().toISOString(),
          }))
      : [];

    const removedLivePlayerIds = Array.isArray(parsed.removedLivePlayerIds)
      ? parsed.removedLivePlayerIds.filter(
          (playerId): playerId is string => typeof playerId === "string",
        )
      : [];

    return {
      addedPlayers,
      removedLivePlayerIds,
    };
  } catch {
    return {
      addedPlayers: [],
      removedLivePlayerIds: [],
    };
  }
}

function sumPlayerAmounts(players: Array<{ amount: number }>) {
  return players.reduce((sum, player) => sum + Math.max(0, player.amount), 0);
}

export function WatcherTeamPlayground() {
  const { data, isLoading, error, refetch, isFetching } =
    useWatcherTeamPlaygroundSnapshot();

  const [addedPlayers, setAddedPlayers] = useState<LocalAddedPlayer[]>([]);
  const [removedLivePlayerIds, setRemovedLivePlayerIds] = useState<string[]>(
    [],
  );
  const [isHydrated, setIsHydrated] = useState(false);

  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerPosition, setNewPlayerPosition] =
    useState<(typeof WATCHER_TEAM_POSITIONS)[number]>("GK");
  const [newPlayerAmount, setNewPlayerAmount] = useState("10");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const localState = parseLocalPlaygroundState(
      window.localStorage.getItem(STORAGE_KEY),
    );

    setAddedPlayers(localState.addedPlayers);
    setRemovedLivePlayerIds(localState.removedLivePlayerIds);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;

    const payload: LocalPlaygroundState = {
      addedPlayers,
      removedLivePlayerIds,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [isHydrated, addedPlayers, removedLivePlayerIds]);

  const watcherTeam = data?.team ?? null;
  const livePlayers = data?.players ?? [];

  const removedLivePlayerIdSet = useMemo(
    () => new Set(removedLivePlayerIds),
    [removedLivePlayerIds],
  );

  const removedLivePlayers = useMemo(
    () => livePlayers.filter((player) => removedLivePlayerIdSet.has(player.id)),
    [livePlayers, removedLivePlayerIdSet],
  );

  const visibleLivePlayers = useMemo(
    () =>
      livePlayers.filter((player) => !removedLivePlayerIdSet.has(player.id)),
    [livePlayers, removedLivePlayerIdSet],
  );

  const pointsRestoredByRemovals = useMemo(
    () => sumPlayerAmounts(removedLivePlayers),
    [removedLivePlayers],
  );

  const pointsSpentByAdditions = useMemo(
    () => sumPlayerAmounts(addedPlayers),
    [addedPlayers],
  );

  const simulatedPlayersOwnedCount =
    Math.max(
      0,
      (watcherTeam?.playersOwnedCount ?? 0) - removedLivePlayers.length,
    ) + addedPlayers.length;

  const simulatedPointsSpent = Math.max(
    0,
    (watcherTeam?.pointsSpent ?? 0) -
      pointsRestoredByRemovals +
      pointsSpentByAdditions,
  );

  const simulatedPointsRemaining = Math.max(
    0,
    (watcherTeam?.pointsTotal ?? 0) - simulatedPointsSpent,
  );

  const simulatedConstraints = calculateTeamBidConstraints({
    pointsRemaining: simulatedPointsRemaining,
    playersOwnedCount: simulatedPlayersOwnedCount,
  });

  const handleToggleLivePlayer = (playerId: string) => {
    setRemovedLivePlayerIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }

      return [...current, playerId];
    });
  };

  const handleRemoveAddedPlayer = (playerId: string) => {
    setAddedPlayers((current) =>
      current.filter((player) => player.id !== playerId),
    );
  };

  const handleAddPlaygroundPlayer = () => {
    const trimmedName = newPlayerName.trim();
    const parsedAmount = Number.parseInt(newPlayerAmount, 10);

    if (!trimmedName) {
      setFormError("Player name is required.");
      return;
    }

    if (!WATCHER_TEAM_POSITION_SET.has(newPlayerPosition)) {
      setFormError("Position must be one of GK, DEF, MID, FWD.");
      return;
    }

    if (
      !Number.isFinite(parsedAmount) ||
      !Number.isInteger(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setFormError("Amount must be a positive integer.");
      return;
    }

    setAddedPlayers((current) => [
      ...current,
      {
        id: createLocalPlayerId(),
        name: trimmedName,
        position1: newPlayerPosition,
        amount: parsedAmount,
        createdAt: new Date().toISOString(),
      },
    ]);

    setNewPlayerName("");
    setNewPlayerPosition("GK");
    setNewPlayerAmount("10");
    setFormError(null);
  };

  const handleClearPlaygroundChanges = () => {
    setAddedPlayers([]);
    setRemovedLivePlayerIds([]);
    setFormError(null);
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error as Error} reset={() => refetch()} />;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-pitch-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-pitch-900/80 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
              Superadmin Route
            </p>
            <h1 className="text-lg font-bold tracking-wide md:text-xl">
              Watcher Team Playground - Sporting CP
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Local simulation only. No auction state is mutated.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/watchgod">
              <Button
                type="button"
                variant="outline"
                className="border-slate-700 bg-slate-900/30 text-slate-300 hover:border-slate-500 hover:bg-slate-800/60"
              >
                <ArrowLeft className="mr-1 size-4" />
                Back To Watchgod
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-pitch-900/50 p-4 md:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Live Refresh
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <RefreshCw
                className={`size-3.5 ${isFetching ? "animate-spin text-accent-gold" : "text-slate-500"}`}
              />
              {isFetching ? "Syncing" : "Every 2s"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Session Status
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-200">
              {data.meta.isAuctionEnded ? "Auction Ended" : "Auction Live"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Team Scope
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-200">
              Sporting CP only
            </p>
          </div>
        </div>

        {!data.meta.hasActiveSession ? (
          <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-pitch-900/30 p-8 text-center">
            <ShieldAlert className="mb-4 size-9 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-200">
              No Active Auction Session
            </h2>
            <p className="mt-2 max-w-lg text-sm text-slate-500">
              Activate an auction session to stream live Sporting CP data into
              this playground.
            </p>
          </div>
        ) : !data.meta.hasWatcherTeam || !watcherTeam ? (
          <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-pitch-900/30 p-8 text-center">
            <ShieldAlert className="mb-4 size-9 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-200">
              Sporting CP Not Found
            </h2>
            <p className="mt-2 max-w-lg text-sm text-slate-500">
              This session does not have a team with short code SCP.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-800 bg-pitch-900/50 p-4 md:p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
                  Live Sporting CP State
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-slate-800 bg-pitch-950/70 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Points Remaining
                    </p>
                    <p className="mt-1 font-mono text-xl text-slate-100">
                      {watcherTeam.pointsRemaining}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-pitch-950/70 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Max Bid
                    </p>
                    <p className="mt-1 font-mono text-xl text-slate-100">
                      {watcherTeam.maxBid}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-pitch-950/70 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Players
                    </p>
                    <p className="mt-1 font-mono text-xl text-slate-100">
                      {watcherTeam.playersOwnedCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-pitch-950/70 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Points Spent
                    </p>
                    <p className="mt-1 font-mono text-xl text-slate-100">
                      {watcherTeam.pointsSpent}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-accent-gold/30 bg-accent-gold/5 p-4 md:p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-accent-gold">
                  Playground Simulation Result
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-accent-gold/25 bg-pitch-950/70 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Points Remaining
                    </p>
                    <p className="mt-1 font-mono text-xl text-slate-100">
                      {simulatedPointsRemaining}
                    </p>
                  </div>
                  <div className="rounded-lg border border-accent-gold/25 bg-pitch-950/70 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Max Bid
                    </p>
                    <p className="mt-1 font-mono text-xl text-slate-100">
                      {simulatedConstraints.maxAllowedBid}
                    </p>
                  </div>
                  <div className="rounded-lg border border-accent-gold/25 bg-pitch-950/70 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Players
                    </p>
                    <p className="mt-1 font-mono text-xl text-slate-100">
                      {simulatedPlayersOwnedCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-accent-gold/25 bg-pitch-950/70 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Points Spent
                    </p>
                    <p className="mt-1 font-mono text-xl text-slate-100">
                      {simulatedPointsSpent}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800/60"
                    onClick={handleClearPlaygroundChanges}
                  >
                    <Undo2 className="mr-1 size-4" />
                    Reset Playground Changes
                  </Button>
                  <p className="text-xs text-slate-500">
                    Local to your browser and never written to auction tables.
                  </p>
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-800 bg-pitch-900/50 p-4 md:p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
                Add Playground Player (Non-persistent)
              </h2>
              <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.6fr_auto]">
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(event) => setNewPlayerName(event.target.value)}
                  placeholder="Player name"
                  className="h-10 rounded-lg border border-slate-700 bg-pitch-950/70 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent-gold focus:outline-none"
                />
                <select
                  value={newPlayerPosition}
                  onChange={(event) =>
                    setNewPlayerPosition(
                      event.target
                        .value as (typeof WATCHER_TEAM_POSITIONS)[number],
                    )
                  }
                  className="h-10 rounded-lg border border-slate-700 bg-pitch-950/70 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent-gold focus:outline-none"
                >
                  {WATCHER_TEAM_POSITIONS.map((position) => (
                    <option key={position} value={position}>
                      {position}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={newPlayerAmount}
                  onChange={(event) => setNewPlayerAmount(event.target.value)}
                  placeholder="Amount"
                  className="h-10 rounded-lg border border-slate-700 bg-pitch-950/70 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent-gold focus:outline-none"
                />
                <Button
                  type="button"
                  className="h-10 bg-accent-gold text-black hover:bg-accent-gold/90"
                  onClick={handleAddPlaygroundPlayer}
                >
                  <UserPlus className="mr-1 size-4" />
                  Add
                </Button>
              </div>

              {formError ? (
                <p className="mt-2 text-xs text-rose-400">{formError}</p>
              ) : null}
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-2xl border border-slate-800 bg-pitch-900/50 p-4 md:p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
                  Live Sporting CP Players ({visibleLivePlayers.length})
                </h2>
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
                  <div className="max-h-[50dvh] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-pitch-900">
                        <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500 whitespace-nowrap">
                          <th className="px-3 py-2">Player</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLivePlayers.length > 0 ? (
                          visibleLivePlayers.map((player) => (
                            <PlayerRow
                              key={player.id}
                              player={player}
                              actionLabel="Remove"
                              actionClassName="text-rose-300 hover:text-rose-200"
                              onAction={() => handleToggleLivePlayer(player.id)}
                            />
                          ))
                        ) : (
                          <tr>
                            <td
                              className="px-3 py-6 text-center text-xs text-slate-500"
                              colSpan={3}
                            >
                              No live Sporting CP players currently visible.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {removedLivePlayers.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-amber-300">
                      Removed In Playground ({removedLivePlayers.length})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {removedLivePlayers.map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          className="rounded-full border border-amber-500/30 bg-pitch-950/80 px-3 py-1 text-xs text-amber-200 hover:bg-pitch-900"
                          onClick={() => handleToggleLivePlayer(player.id)}
                        >
                          Restore {player.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl border border-slate-800 bg-pitch-900/50 p-4 md:p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
                  Playground Added Players ({addedPlayers.length})
                </h2>
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
                  <div className="max-h-[50dvh] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-pitch-900">
                        <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500 whitespace-nowrap">
                          <th className="px-3 py-2">Player</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {addedPlayers.length > 0 ? (
                          addedPlayers.map((player) => (
                            <tr
                              key={player.id}
                              className="border-b border-slate-800/80 text-slate-200 last:border-none"
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                <p className="font-medium text-slate-100">
                                  {player.name}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {formatCategoryLabel(player.position1)}
                                </p>
                              </td>
                              <td className="px-3 py-2 font-mono text-sm text-slate-300 whitespace-nowrap">
                                {player.amount}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-rose-300 hover:border-rose-400/40 hover:text-rose-200"
                                  onClick={() =>
                                    handleRemoveAddedPlayer(player.id)
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              className="px-3 py-6 text-center text-xs text-slate-500"
                              colSpan={3}
                            >
                              No playground-added players yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function PlayerRow({
  player,
  actionLabel,
  actionClassName,
  onAction,
}: {
  player: WatcherTeamLivePlayer;
  actionLabel: string;
  actionClassName: string;
  onAction: () => void;
}) {
  return (
    <tr className="border-b border-slate-800/80 text-slate-200 last:border-none">
      <td className="px-3 py-2 whitespace-nowrap">
        <p className="font-medium text-slate-100">{player.name}</p>
        <p className="text-[11px] text-slate-500">
          {formatCategoryLabel(player.position1)}
        </p>
      </td>
      <td className="px-3 py-2 font-mono text-sm text-slate-300 whitespace-nowrap">
        {player.amount}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs ${actionClassName}`}
          onClick={onAction}
        >
          <Trash2 className="size-3.5" />
          {actionLabel}
        </button>
      </td>
    </tr>
  );
}
