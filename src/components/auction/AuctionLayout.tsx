"use client";

import { UserButton } from "@clerk/nextjs";
import { Menu, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useAuctionLog,
  useCurrentPlayer,
  useNextPlayer,
  useTeams,
} from "@/hooks/useAuction";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
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
  const { data: logs } = useAuctionLog();
  const nextPlayerMutation = useNextPlayer();
  const {
    mutate: loadNextPlayer,
    isPending: isLoadingNextPlayer,
    isError: hasNextPlayerError,
  } = nextPlayerMutation;

  const player = current?.player ?? null;
  const currentCategoryLabel = formatCategoryLabel(player?.position1);
  const isComplete = current?.isComplete ?? false;

  const loading = teamsLoading || playerLoading;
  const error = teamsError || playerError;

  useEffect(() => {
    if (
      loading ||
      error ||
      player ||
      isComplete ||
      isLoadingNextPlayer ||
      hasNextPlayerError
    ) {
      return;
    }

    loadNextPlayer();
  }, [
    error,
    hasNextPlayerError,
    isComplete,
    isLoadingNextPlayer,
    loadNextPlayer,
    loading,
    player,
  ]);

  if (loading) return <LoadingState />;
  if (error)
    return (
      <ErrorState
        error={error as Error}
        reset={() => {
          rTeams();
          rPlayer();
        }}
      />
    );
  if (!teams) return null;

  return (
    <div className="flex w-full h-[100dvh] bg-[#0a0a0a] text-slate-200 antialiased overflow-hidden">
      {/* Left Sidebar: Team List */}
      {!isFocusMode && (
        <div className="hidden md:flex w-[320px] flex-shrink-0 flex-col h-full min-h-0 bg-[#111111] border-r border-[#222]">
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
          <div className="flex-1 flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden">
            {/* Player Preview */}
            <div
              className={`transition-all duration-500 ease-in-out ${
                isFocusMode
                  ? "w-full md:w-[60%] lg:w-[65%]"
                  : "w-full md:w-1/2 lg:w-[45%]"
              } md:h-full flex flex-col items-center justify-center gap-6 p-4 md:p-6 lg:p-12 relative border-b md:border-b-0 md:border-r border-[#222] min-h-[40vh] md:min-h-0`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#111]/80 to-transparent z-0 pointer-events-none" />
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
            <div className="w-full md:flex-1 md:h-full flex flex-col items-center justify-start md:justify-center p-4 md:p-6 lg:p-12 bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] pb-10 md:pb-safe">
              <BidControls player={player} teams={teams} logs={logs || []} />
            </div>
          </div>
        ) : isComplete ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black">
            <h2 className="text-3xl font-light tracking-widest text-[#555] mb-2 uppercase">
              Auction Complete
            </h2>
            <p className="text-[#444] text-sm">
              All players have been processed.
            </p>
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
      </div>
    </div>
  );
}
