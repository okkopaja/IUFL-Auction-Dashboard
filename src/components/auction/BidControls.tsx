"use client";

import { FastForward, Gavel, History, Minus, Plus, Rewind } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useNextPlayer, useSellPlayer } from "@/hooks/useAuction";
import { AUCTION_BID_STEP } from "@/lib/constants";
import { useAuctionStore } from "@/store/auctionStore";
import type { Player, Team, Transaction } from "@/types";
import { Button } from "../ui/button";
import { TeamSelectPopup } from "./TeamSelectPopup";
import { TeamLogo } from "../shared/TeamLogo";

export function BidControls({
  player,
  teams,
  logs,
}: {
  player: Player;
  teams: Team[];
  logs: Transaction[];
}) {
  const currentBid = useAuctionStore((state) => state.currentBid);
  const selectedTeamId = useAuctionStore((state) => state.selectedTeamId);
  const setBid = useAuctionStore((state) => state.setBid);

  const sellMutation = useSellPlayer();
  const nextMutation = useNextPlayer();

  useEffect(() => {
    // If the store bid is 0, initialize it to base price when player mounts
    if (currentBid === 0 && player.basePrice > 0) {
      setBid(player.basePrice);
    }
  }, [player.id, player.basePrice, currentBid, setBid]);

  const handleIncrement = () => setBid(currentBid + AUCTION_BID_STEP);
  const handleDecrement = () =>
    setBid(Math.max(player.basePrice, currentBid - AUCTION_BID_STEP));

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  const handleSell = () => {
    if (!selectedTeamId) {
      toast.error("Please select a team from the sidebar before selling.");
      return;
    }
    if (selectedTeam && selectedTeam.pointsRemaining < currentBid) {
      toast.error("Team does not have enough points.");
      return;
    }

    sellMutation.mutate(
      { teamId: selectedTeamId, amount: currentBid },
      {
        onSuccess: () => {
          toast.success(
            `${player.name} sold to ${selectedTeam?.name} for ${currentBid}`,
          );
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.error || "Error selling player");
        },
      },
    );
  };

  const handleNext = () => {
    nextMutation.mutate(undefined, {
      onError: () => {
        toast.error("Error moving to next player");
      },
    });
  };

  const previousTransaction = logs?.[0];

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-8 z-20">
      {/* Bid Adjustment Container */}
      <div className="flex items-center justify-between w-full bg-pitch-900 border border-slate-700/50 rounded-3xl p-4 shadow-xl backdrop-blur-md">
        <Button
          variant="outline"
          size="icon"
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-slate-600 bg-pitch-950 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          onClick={handleDecrement}
          disabled={currentBid <= player.basePrice}
        >
          <Minus className="w-8 h-8 sm:w-10 sm:h-10" />
        </Button>

        <div className="flex flex-col items-center justify-center flex-1">
          <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">
            Bid Value
          </span>
          <span className="text-5xl sm:text-6xl font-mono font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            {currentBid || player.basePrice}
          </span>
        </div>

        <Button
          variant="outline"
          size="icon"
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-slate-600 bg-pitch-950 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          onClick={handleIncrement}
        >
          <Plus className="w-8 h-8 sm:w-10 sm:h-10" />
        </Button>
      </div>

      {/* Target Team Selection (Mobile only, but could be unified) */}
      <div className="w-full md:hidden">
        <TeamSelectPopup teams={teams} />
      </div>

      {/* Sell Button */}
      <Button
        size="lg"
        className="w-full h-20 text-2xl font-black uppercase tracking-widest bg-accent-gold text-black hover:bg-yellow-400 border-accent-gold rounded-3xl shadow-[0_0_30px_rgba(245,200,66,0.3)] hover:shadow-[0_0_50px_rgba(245,200,66,0.5)] transition-all flex items-center justify-center"
        onClick={handleSell}
        disabled={
          sellMutation.isPending || nextMutation.isPending || !selectedTeamId
        }
      >
        <Gavel className="w-8 h-8 mr-4" />
        {sellMutation.isPending ? "Selling..." : "Sell"}
      </Button>

      {/* If a team is selected on desktop, show it below SELL to make "to select one and sell" clear */}
      <div className="hidden md:flex flex-col items-center gap-2 mt-[-1rem]">
        {selectedTeamId ? (
          <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">
            Selling to:{" "}
            <span className="font-bold text-accent-gold">
              {selectedTeam?.shortCode}
            </span>
          </span>
        ) : (
          <span className="text-xs text-rose-400 font-mono tracking-wider uppercase">
            Select a team from list first
          </span>
        )}
      </div>

      {/* Prev / Next Controls */}
      <div className="flex w-full gap-4 justify-center">
        {/* We only have logic for pass/next in the current hooks, so I'll wrap it in a single Next button that looks like >> or keep << disabled. */}
        <Button
          variant="outline"
          className="flex-1 h-14 bg-pitch-900 border-slate-700 hover:bg-slate-800 text-slate-400 rounded-2xl uppercase tracking-wider font-bold opacity-50 cursor-not-allowed"
          disabled
        >
          <Rewind className="w-6 h-6" />
        </Button>

        <Button
          variant="outline"
          className="flex-1 h-14 bg-pitch-900 border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl uppercase tracking-wider font-bold"
          onClick={handleNext}
          disabled={sellMutation.isPending || nextMutation.isPending}
        >
          <FastForward className="w-6 h-6" />
        </Button>
      </div>

      {/* Previous Player Box */}
      {previousTransaction ? (
        <div className="w-full bg-pitch-900/80 border border-slate-700/50 rounded-3xl p-6 flex flex-col items-center justify-center text-center backdrop-blur shadow-inner mt-4">
          <History className="w-5 h-5 text-slate-500 mb-3" />
          <h4 className="text-lg font-bold text-slate-200 uppercase tracking-widest mb-2 leading-tight">
            {previousTransaction.player.name}
          </h4>
          <div className="flex items-center justify-center gap-2 text-sm font-mono text-slate-400">
            <span>bought by</span>
            <span className="flex items-center gap-1 font-bold text-white bg-slate-800 px-2 py-1 rounded">
              <TeamLogo
                domain={previousTransaction.team.domain}
                name={previousTransaction.team.name}
                size={16}
              />
              {previousTransaction.team.shortCode}
            </span>
            <span>for</span>
            <span className="font-bold text-accent-gold ml-1">
              ♦ {previousTransaction.amount}
            </span>
          </div>
        </div>
      ) : (
        <div className="w-full bg-pitch-900/50 border border-slate-800/50 rounded-3xl p-6 flex items-center justify-center text-center mt-4 border-dashed">
          <span className="text-slate-600 font-mono text-xs uppercase tracking-widest">
            No previous transaction
          </span>
        </div>
      )}
    </div>
  );
}
