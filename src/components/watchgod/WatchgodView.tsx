"use client";

import { UserButton } from "@clerk/nextjs";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  useWatchgodSnapshot,
  WATCHGOD_PAGE_SIZE,
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
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch, isFetching } = useWatchgodSnapshot();

  const progression = data?.progression ?? [];
  const teams = data?.teams ?? [];
  const pageSize = data?.meta.pageSize ?? WATCHGOD_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(progression.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return progression.slice(start, start + pageSize);
  }, [page, pageSize, progression]);

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
                    5 passed players + current player + full upcoming queue
                    (unsold)
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Total {data.meta.totalProgressionCount}</p>
                  <p>Upcoming {data.meta.upcomingCount}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-800">
                <div className="max-h-[65dvh] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-pitch-900">
                      <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500 whitespace-nowrap">
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Player</th>
                        <th className="px-3 py-2">Queue</th>
                        <th className="px-3 py-2">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row, idx) => {
                        const absoluteIndex = (page - 1) * pageSize + idx + 1;

                        return (
                          <tr
                            key={row.id}
                            className="border-b border-slate-800/80 text-slate-200 last:border-none"
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Page {page} / {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="size-4" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={page >= totalPages}
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
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
