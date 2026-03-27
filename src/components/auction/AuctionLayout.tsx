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
    <div className="flex w-full h-[100dvh] bg-[#0a0a0a] text-slate-200 antialiased overflow-hidden">
      {/* Theme toggle — top-right corner */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Left Sidebar: Team List */}
      <div className="hidden md:flex w-[320px] flex-shrink-0 flex-col h-full bg-[#111111] border-r border-[#222]">
        <div className="p-6 border-b border-[#222]">
          <h2 className="text-sm font-semibold text-slate-400 tracking-wider uppercase">
            Franchise Standings
          </h2>
        </div>
        <div className="flex-1 overflow-hidden p-3">
          <TeamSidebar teams={teams} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-[#0a0a0a] relative">
        {player ? (
          <div className="flex-1 flex flex-col md:flex-row h-full">
            {/* Player Preview */}
            <div className="w-full md:w-1/2 lg:w-[45%] h-full flex items-center justify-center p-6 lg:p-12 relative border-b md:border-b-0 md:border-r border-[#222]">
              <div className="absolute inset-0 bg-gradient-to-br from-[#111]/80 to-transparent z-0 pointer-events-none" />
              <PlayerCard player={player} />
            </div>

            {/* Bidding Controls Area */}
            <div className="flex-1 h-full flex flex-col items-center justify-center p-6 lg:p-12 bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f]">
              <BidControls player={player} teams={teams} logs={logs || []} />
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black">
            <h2 className="text-3xl font-light tracking-widest text-[#555] mb-2 uppercase">
              Auction Complete
            </h2>
            <p className="text-[#444] text-sm">
              All players have been processed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
