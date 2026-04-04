"use client";

import { UserButton } from "@clerk/nextjs";
import { Maximize2, Menu, Minimize2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useAcknowledgeAuctionRestart,
  useAuctionLog,
  useCurrentPlayer,
  useNextPlayer,
  usePlayers,
  useTeams,
} from "@/hooks/useAuction";
import { ROUTES } from "@/lib/constants";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { BidControls } from "./BidControls";
import { PlayerCard } from "./PlayerCard";
import { TeamSidebar } from "./TeamSidebar";

function formatCategoryLabel(position: string | null | undefined) {
  if (!position) return "Unspecified";

  return position
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AuctionLayout() {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [browsePlayerId, setBrowsePlayerId] = useState<string | null>(null);
  const {
    data: teams,
    isLoading: teamsLoading,
    error: teamsError,
    refetch: rTeams,
  } = useTeams();
  const {
    data: current,
    isLoading: playerLoading,
    error: playerError,
    refetch: rPlayer,
  } = useCurrentPlayer();
  const {
    data: allPlayers,
    isLoading: playersLoading,
    error: playersError,
    refetch: rPlayers,
  } = usePlayers();
  const { data: logs } = useAuctionLog();
  const nextPlayerMutation = useNextPlayer();
  const acknowledgeRestartMutation = useAcknowledgeAuctionRestart();
  const {
    mutate: loadNextPlayer,
    isPending: isLoadingNextPlayer,
    isError: hasNextPlayerError,
  } = nextPlayerMutation;

  const livePlayer = current?.player ?? null;
  const restartAckRequired = current?.restartAckRequired ?? false;
  const isAuctionEnded = current?.isAuctionEnded ?? false;
  const auctionEndReason = current?.auctionEndReason ?? null;
  const isComplete = current?.isComplete ?? false;

  const orderedPlayers = allPlayers ?? [];
  const browsePlayer = useMemo(() => {
    if (!browsePlayerId) return null;
    return (
      orderedPlayers.find((player) => player.id === browsePlayerId) ?? null
    );
  }, [browsePlayerId, orderedPlayers]);

  const player = browsePlayer ?? livePlayer;
  const currentCategoryLabel = formatCategoryLabel(player?.position1);
  const loading = teamsLoading || playerLoading || playersLoading;
  const error = teamsError || playerError || playersError;
  const hasEnded = isAuctionEnded || isComplete;

  useEffect(() => {
    if (!browsePlayerId) return;

    const stillExists = orderedPlayers.some(
      (candidate) => candidate.id === browsePlayerId,
    );
    if (!stillExists) {
      setBrowsePlayerId(null);
    }
  }, [browsePlayerId, orderedPlayers]);

  useEffect(() => {
    if (hasEnded && browsePlayerId) {
      setBrowsePlayerId(null);
    }
  }, [browsePlayerId, hasEnded]);

  useEffect(() => {
    if (
      loading ||
      error ||
      player ||
      hasEnded ||
      isLoadingNextPlayer ||
      hasNextPlayerError ||
      restartAckRequired
    ) {
      return;
    }

    loadNextPlayer();
  }, [
    error,
    hasNextPlayerError,
    hasEnded,
    isLoadingNextPlayer,
    loadNextPlayer,
    loading,
    player,
    restartAckRequired,
  ]);

  const handleRestartAcknowledge = () => {
    acknowledgeRestartMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Auction iteration restart acknowledged.");
      },
      onError: () => {
        toast.error("Could not acknowledge restart. Please try again.");
      },
    });
  };

  if (loading) return <LoadingState />;
  if (error)
    return (
      <ErrorState
        error={error as Error}
        reset={() => {
          rTeams();
          rPlayer();
          rPlayers();
        }}
      />
    );
  if (!teams) return null;

  return (
    <div className="flex w-full h-dvh bg-[#0a0a0a] text-slate-200 antialiased overflow-hidden">
      {/* Left Sidebar: Team List */}
      {!isFocusMode && (
        <div className="hidden md:flex w-[320px] shrink-0 flex-col h-full min-h-0 bg-[#111111] border-r border-[#222]">
          <div className="p-6 border-b border-[#222]">
            <h2 className="text-sm font-semibold text-slate-400 tracking-wider uppercase">
              Franchise Standings
            </h2>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <TeamSidebar teams={teams} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-[#0a0a0a] relative">
        <div className="hidden md:flex absolute top-4 right-4 z-20">
          <UserButton
            appearance={{
              elements: {
                avatarBox:
                  "size-8 ring-2 ring-accent-gold/40 hover:ring-accent-gold/80 transition-all duration-200 rounded-full",
              },
            }}
          />
        </div>

        {/* Mobile Header / Sidebar Toggle */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-[#222] bg-[#111] z-20">
          <Sheet>
            <SheetTrigger className="p-2 -ml-2 text-slate-300 hover:text-white transition-colors">
              <Menu className="w-6 h-6" />
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="h-[80vh] p-0 bg-[#111111] border-t border-[#222] rounded-t-2xl flex flex-col"
            >
              <SheetHeader className="p-6 border-b border-[#222] text-left shrink-0">
                <SheetTitle className="text-sm font-semibold text-slate-400 tracking-wider uppercase">
                  Franchise Standings
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-3">
                <TeamSidebar teams={teams} />
              </div>
            </SheetContent>
          </Sheet>
          <span className="text-xs font-bold text-accent-gold uppercase tracking-widest">
            IUFL Auction
          </span>
          <UserButton
            appearance={{
              elements: {
                avatarBox:
                  "size-8 ring-2 ring-accent-gold/40 hover:ring-accent-gold/80 transition-all duration-200 rounded-full",
              },
            }}
          />
        </div>
        {player ? (
          <div className="flex-1 flex flex-col md:flex-row h-full overflow-y-auto overflow-x-hidden md:overflow-hidden">
            {/* Player Preview */}
            <div
              className={`transition-all duration-500 ease-in-out ${
                isFocusMode
                  ? "w-full md:w-[60%] lg:w-[65%]"
                  : "w-full md:w-1/2 lg:w-[45%]"
              } md:h-full flex flex-col items-center justify-center gap-6 p-4 md:p-6 lg:p-12 relative border-b md:border-b-0 md:border-r border-[#222] min-h-[40vh] md:min-h-0`}
            >
              <div className="absolute inset-0 bg-linear-to-br from-[#111]/80 to-transparent z-0 pointer-events-none" />
              <div
                className={`relative z-10 text-center transition-all duration-500 ${isFocusMode ? "scale-125 mb-4" : ""}`}
              >
                <p className="text-[11px] font-semibold text-slate-500 tracking-[0.24em] uppercase">
                  Current Category
                </p>
                <h2 className="mt-2 text-2xl md:text-3xl font-black text-white uppercase tracking-wider">
                  {currentCategoryLabel}
                </h2>
              </div>
              <PlayerCard player={player} isFocusMode={isFocusMode} />

              <button
                type="button"
                onClick={() => setIsFocusMode(!isFocusMode)}
                className="mt-2 z-10 flex items-center justify-center gap-2 px-6 py-2.5 rounded-full border border-[#333] bg-[#111]/80 backdrop-blur-sm text-slate-300 font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-[#222] hover:text-white hover:border-accent-gold/50 transition-all duration-300"
              >
                {isFocusMode ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" /> Normal View
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" /> Focus Profile
                  </>
                )}
              </button>
            </div>

            {/* Bidding Controls Area */}
            <div className="w-full md:flex-1 md:h-full flex flex-col items-center justify-start md:justify-center p-4 md:p-6 lg:p-12 bg-linear-to-b from-[#0a0a0a] to-[#0f0f0f] pb-10 md:pb-safe">
              <BidControls
                player={player}
                livePlayer={livePlayer}
                allPlayers={orderedPlayers}
                teams={teams}
                logs={logs || []}
                controlsLocked={
                  restartAckRequired || acknowledgeRestartMutation.isPending
                }
                onBrowsePlayerChange={setBrowsePlayerId}
              />
            </div>
          </div>
        ) : hasEnded ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black">
            <h2 className="text-3xl font-light tracking-widest text-[#555] mb-2 uppercase">
              Auction Ended
            </h2>
            <p className="text-[#444] text-sm text-center max-w-md px-6">
              {auctionEndReason === "UNSOLD_DEPLETED"
                ? "Auction is ended. No unsold players remain."
                : "Auction is ended, Iterated through unsold players twice."}
            </p>
            <Link href={ROUTES.PLAYERS} className="mt-6">
              <Button
                type="button"
                className="h-10 px-6 rounded-lg bg-accent-gold text-black hover:bg-accent-gold/90 font-semibold uppercase tracking-wider"
              >
                Navigate to All Players
              </Button>
            </Link>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black">
            <p className="text-[#666] text-sm uppercase tracking-widest">
              {isLoadingNextPlayer
                ? "Preparing next player..."
                : "Waiting for next player"}
            </p>
            {hasNextPlayerError ? (
              <div className="mt-4 flex flex-col items-center gap-3">
                <p className="text-xs text-rose-400 uppercase tracking-[0.16em]">
                  Could not load next player
                </p>
                <button
                  type="button"
                  className="h-9 px-4 rounded-lg border border-[#333] text-slate-200 text-xs font-semibold uppercase tracking-widest hover:bg-[#151515] transition-colors"
                  onClick={() => loadNextPlayer()}
                  disabled={isLoadingNextPlayer}
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        )}

        <Dialog open={restartAckRequired}>
          <DialogContent
            showCloseButton={false}
            className="max-w-md border border-[#333] bg-[#111] text-slate-100"
          >
            <DialogHeader>
              <DialogTitle className="text-lg font-bold uppercase tracking-wide text-accent-gold">
                Auction Iteration Restart
              </DialogTitle>
              <DialogDescription className="text-slate-300 leading-relaxed whitespace-pre-line">
                {
                  "Iterated through all unsold players once.\nRestarting from the first unsold player again"
                }
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="border-[#222] bg-[#0f0f0f]">
              <Button
                type="button"
                className="bg-accent-gold text-black hover:bg-accent-gold/90 font-semibold uppercase tracking-wider"
                onClick={handleRestartAcknowledge}
                disabled={acknowledgeRestartMutation.isPending}
              >
                {acknowledgeRestartMutation.isPending ? "Saving..." : "OK"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
