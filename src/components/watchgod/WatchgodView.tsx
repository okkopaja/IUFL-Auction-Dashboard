"use client";

import { UserButton } from "@clerk/nextjs";
import { Eye, GripVertical, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { type DragEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useReorderWatchgodQueue,
  useWatchgodSnapshot,
  type WatchgodProgressionRow,
} from "@/hooks/useWatchgod";
import { ROUTES } from "@/lib/constants";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { Button } from "../ui/button";

function formatCategoryLabel(position: string | null | undefined) {
  if (!position) return "Unspecified";

  return position
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "--";

  return new Date(parsed).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getQueueTone(queueType: WatchgodProgressionRow["queueType"]) {
  if (queueType === "CURRENT") {
    return "border-accent-gold/35 bg-accent-gold/10 text-accent-gold";
  }

  if (queueType === "PASSED") {
    return "border-slate-700 bg-slate-800/50 text-slate-300";
  }

  return "border-emerald-500/35 bg-emerald-500/10 text-emerald-300";
}

export function WatchgodView() {
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useWatchgodSnapshot();
  const reorderQueue = useReorderWatchgodQueue();

  const progression = data?.progression ?? [];
  const teams = data?.teams ?? [];
  const swappablePlayerIds = useMemo(
    () =>
      new Set(
        progression
          .filter(
            (row) => row.queueType === "UPCOMING" && !row.player.hasBeenPassed,
          )
          .map((row) => row.player.id),
      ),
    [progression],
  );

  const swapPlayers = (playerId: string, targetPlayerId: string) => {
    if (playerId === targetPlayerId || reorderQueue.isPending) {
      return;
    }

    reorderQueue.mutate(
      { playerId, targetPlayerId },
      {
        onSuccess: () => {
          toast.success("Auction queue updated.");
        },
        onError: (requestError: unknown) => {
          const message =
            typeof requestError === "object" &&
            requestError !== null &&
            "response" in requestError &&
            typeof (
              requestError as {
                response?: { data?: { error?: unknown } };
              }
            ).response?.data?.error === "string"
              ? (
                  requestError as {
                    response: { data: { error: string } };
                  }
                ).response.data.error
              : "Could not update the auction queue.";
          toast.error(message);
        },
      },
    );
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
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent-gold/35 bg-accent-gold/10">
              <Eye className="size-5 text-accent-gold" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                Superadmin View
              </p>
              <h1 className="text-base font-bold tracking-wide md:text-xl">
                Watchgod Live Auction Monitor
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <Link href={ROUTES.AUCTION} className="flex-1 sm:flex-none">
              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-700 bg-slate-900/30 text-xs sm:text-sm text-slate-300 hover:border-slate-500 hover:bg-slate-800/60"
              >
                Back To Auction
              </Button>
            </Link>
            <Link href="/watchgod/playground" className="flex-1 sm:flex-none">
              <Button
                type="button"
                variant="outline"
                className="w-full border-accent-gold/50 bg-accent-gold/10 text-xs sm:text-sm text-accent-gold hover:bg-accent-gold/20"
              >
                Watcher Team
              </Button>
            </Link>
            <Link href="/watchgod/teams-dist" className="flex-1 sm:flex-none">
              <Button
                type="button"
                variant="outline"
                className="w-full border-violet-500/50 bg-violet-500/10 text-xs sm:text-sm text-violet-300 hover:bg-violet-500/20"
              >
                Teams Dist
              </Button>
            </Link>
            <div className="flex shrink-0 items-center justify-center">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox:
                      "size-8 ring-2 ring-accent-gold/40 hover:ring-accent-gold/80 transition-all duration-200 rounded-full",
                  },
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-800 bg-pitch-900/50 p-4 md:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Last Updated
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-200">
              {formatTimestamp(data.meta.generatedAt)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Session State
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-200">
              {data.meta.isAuctionEnded ? "Ended" : "Live"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Iteration Round
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-200">
              {data.meta.unsoldIterationRound}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Refresh Status
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <RefreshCw
                className={`size-3.5 ${isFetching ? "animate-spin text-accent-gold" : "text-slate-500"}`}
              />
              {isFetching ? "Syncing" : "Live every 2s"}
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
              Start or reactivate an auction session to stream progression and
              live team limits here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
            <section className="rounded-2xl border border-slate-800 bg-pitch-900/50 p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    Live Progression Queue
                  </h2>
                  <p className="text-xs text-slate-500">
                    Upcoming queue order updates live.
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Total {data.meta.totalProgressionCount}</p>
                  <p>Upcoming {data.meta.upcomingCount}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-800">
                <div className="max-h-[30.5rem] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-pitch-900">
                      <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500 whitespace-nowrap">
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Player</th>
                        <th className="px-3 py-2">Queue</th>
                        <th className="px-3 py-2">State</th>
                        <th className="px-3 py-2 text-right">Move</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progression.map((row, idx) => {
                        const absoluteIndex = idx + 1;
                        const canSwap =
                          swappablePlayerIds.has(row.player.id) &&
                          !reorderQueue.isPending;
                        const isDragging = draggedPlayerId === row.player.id;
                        const isDropTarget =
                          Boolean(draggedPlayerId) &&
                          draggedPlayerId !== row.player.id &&
                          canSwap;

                        const handleDragStart = (
                          event: DragEvent<HTMLTableRowElement>,
                        ) => {
                          if (!canSwap) {
                            event.preventDefault();
                            return;
                          }

                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "text/plain",
                            row.player.id,
                          );
                          setDraggedPlayerId(row.player.id);
                        };

                        const handleDragOver = (
                          event: DragEvent<HTMLTableRowElement>,
                        ) => {
                          if (isDropTarget) {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                          }
                        };

                        const handleDrop = (
                          event: DragEvent<HTMLTableRowElement>,
                        ) => {
                          event.preventDefault();

                          if (isDropTarget) {
                            const playerId =
                              event.dataTransfer.getData("text/plain");
                            swapPlayers(playerId, row.player.id);
                          }

                          setDraggedPlayerId(null);
                        };

                        return (
                          <tr
                            key={row.id}
                            draggable={canSwap}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onDragEnd={() => setDraggedPlayerId(null)}
                            className={`h-16 border-b border-slate-800/80 text-slate-200 transition-colors last:border-none ${
                              canSwap
                                ? "cursor-grab active:cursor-grabbing"
                                : ""
                            } ${
                              isDragging ? "bg-accent-gold/10 opacity-70" : ""
                            } ${
                              isDropTarget
                                ? "outline outline-1 -outline-offset-1 outline-emerald-400/70"
                                : ""
                            }`}
                          >
                            <td className="px-3 py-2 font-mono text-xs text-slate-400 whitespace-nowrap">
                              {absoluteIndex}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <p className="font-medium text-slate-100">
                                {row.player.name}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {formatCategoryLabel(row.player.position1)}
                                {row.player.teamShortCode
                                  ? ` • ${row.player.teamShortCode}`
                                  : ""}
                                {row.player.transactionAmount !== null
                                  ? ` • ${row.player.transactionAmount}`
                                  : ""}
                              </p>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span
                                className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${getQueueTone(row.queueType)}`}
                              >
                                {row.queueType}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-300 whitespace-nowrap">
                              {row.actionType
                                ? `${row.actionType} • ${formatTimestamp(row.actionAt ?? "")}`
                                : row.player.status}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex justify-end gap-1">
                                <span
                                  className={`inline-flex size-7 items-center justify-center rounded-md ${
                                    canSwap
                                      ? "text-slate-300"
                                      : "text-slate-600"
                                  }`}
                                  title={
                                    canSwap
                                      ? "Drag to swap queue position"
                                      : "Locked"
                                  }
                                >
                                  <GripVertical className="size-4" />
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-pitch-900/50 p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    Live Teams Points And Max Bid
                  </h2>
                  <p className="text-xs text-slate-500">
                    All teams in active session
                  </p>
                </div>
                {data.meta.restartAckRequired ? (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    Restart Ack Required
                  </span>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-800">
                <div className="max-h-[65dvh] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-pitch-900">
                      <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500 whitespace-nowrap">
                        <th className="px-3 py-2">Team</th>
                        <th className="px-3 py-2">Remaining</th>
                        <th className="px-3 py-2">Max Bid</th>
                        <th className="px-3 py-2">Players</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.length > 0 ? (
                        teams.map((team) => (
                          <tr
                            key={team.id}
                            className="border-b border-slate-800/80 text-slate-200 last:border-none"
                          >
                            <td className="px-3 py-2 whitespace-nowrap">
                              <p className="font-medium text-slate-100">
                                {team.shortCode}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {team.name}
                              </p>
                            </td>
                            <td className="px-3 py-2 font-mono text-sm whitespace-nowrap">
                              {team.pointsRemaining}
                            </td>
                            <td className="px-3 py-2 font-mono text-sm whitespace-nowrap">
                              <span
                                className={
                                  team.canAffordMinimumBid
                                    ? "text-emerald-300"
                                    : "text-rose-300"
                                }
                              >
                                {team.maxBid}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-sm text-slate-300 whitespace-nowrap">
                              {team.playersOwnedCount}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            className="px-3 py-6 text-center text-xs text-slate-500"
                            colSpan={4}
                          >
                            No teams found in active session.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
