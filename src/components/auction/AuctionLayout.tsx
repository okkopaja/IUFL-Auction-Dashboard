"use client";

import { useAuctionLog, useCurrentPlayer, useTeams } from "@/hooks/useAuction";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { ThemeToggle } from "../shared/ThemeToggle";
import { BidControls } from "./BidControls";
import { PlayerCard } from "./PlayerCard";
import { TeamSidebar } from "./TeamSidebar";

export function AuctionLayout() {
  const {
    data: teams,
    isLoading: teamsLoading,
    error: teamsError,
    refetch: rTeams,
  } = useTeams();
  const {
    data: player,
    isLoading: playerLoading,
    error: playerError,
    refetch: rPlayer,
  } = useCurrentPlayer();
  const { data: logs } = useAuctionLog();

  const loading = teamsLoading || playerLoading;
  const error = teamsError || playerError;

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
    <div className="flex w-full h-[100dvh] p-4 md:p-8 gap-6 relative z-10 overflow-hidden text-slate-200">
      {/* Theme toggle — top-right corner */}
      <div className="absolute top-4 right-4 z-50 md:top-8 md:right-8">
        <ThemeToggle />
      </div>

      <div className="hidden md:flex w-[320px] flex-shrink-0 flex-col h-full bg-pitch-900/60 border border-slate-800/80 rounded-[2.5rem] shadow-2xl backdrop-blur-xl p-4">
        <h2 className="text-xl font-heading text-center text-slate-300 tracking-widest mb-4 mt-2">
          Team List
        </h2>
        <TeamSidebar teams={teams} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden w-full gap-6">
        <div className="flex-1 rounded-[3rem] border border-slate-700/50 bg-pitch-900/40 shadow-2xl backdrop-blur-3xl overflow-hidden p-6 md:p-10 flex gap-6 md:gap-10 relative">
          {player ? (
            <>
              {/* Left Side: Player Area */}
              <div className="w-full md:w-5/12 flex-shrink-0 flex flex-col items-center justify-center border border-slate-700/40 rounded-[2.5rem] p-6 lg:p-10 bg-slate-900/50 relative shadow-inner overflow-hidden group hover:border-slate-600/60 transition-colors duration-500">
                <PlayerCard player={player} />
              </div>

              {/* Right Side: Controls Area */}
              <div className="flex-1 flex flex-col justify-center items-center gap-6">
                <BidControls player={player} teams={teams} logs={logs || []} />
              </div>
            </>
          ) : (
            <div className="w-full flex flex-col items-center justify-center text-center">
              <h2 className="text-4xl font-heading mb-4 text-accent-gold drop-shadow-lg">
                Auction Complete
              </h2>
              <p className="text-slate-400 text-lg">
                All players have been processed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
