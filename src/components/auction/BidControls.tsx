"use client";

import { FastForward, Gavel, History, Minus, Plus, Rewind } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useNextPlayer, useSellPlayer } from "@/hooks/useAuction";
import {
  AUCTION_BID_STEP_BASE,
  AUCTION_BID_STEP_HIGH,
  AUCTION_BID_STEP_THRESHOLD,
  AUCTION_START_BID,
} from "@/lib/constants";
import { useAuctionStore } from "@/store/auctionStore";
import type { Player, Team, Transaction } from "@/types";
import { TeamLogo } from "../shared/TeamLogo";
import { Button } from "../ui/button";
import { TeamSelectPopup } from "./TeamSelectPopup";

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
    if (currentBid === 0) {
      setBid(AUCTION_START_BID);
    }
  }, [player.id, currentBid, setBid]);

  const getBidStep = (bid: number) =>
    bid >= AUCTION_BID_STEP_THRESHOLD
      ? AUCTION_BID_STEP_HIGH
      : AUCTION_BID_STEP_BASE;

  const handleIncrement = () => setBid(currentBid + getBidStep(currentBid));
  const handleDecrement = () =>
    setBid(Math.max(AUCTION_START_BID, currentBid - getBidStep(currentBid)));

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
      { playerId: player.id, teamId: selectedTeamId, amount: currentBid },
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
    <div className="w-full max-w-[440px] flex flex-col items-center gap-6 z-20">
      {/* Bid Display */}
      <div className="w-full flex flex-col items-center mb-4">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
          Current Bid
        </span>
        <div className="flex items-center justify-between w-full">
          <button
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-[#1a1a1a] border border-[#333] text-slate-400 hover:text-white hover:bg-[#222] hover:border-[#444] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleDecrement}
            disabled={currentBid <= AUCTION_START_BID}
          >
            <Minus className="w-6 h-6" />
          </button>

          <div className="flex-1 flex justify-center text-6xl md:text-8xl font-mono font-medium text-white tracking-tighter">
            {currentBid || AUCTION_START_BID}
          </div>

          <button
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-[#1a1a1a] border border-[#333] text-slate-400 hover:text-white hover:bg-[#222] hover:border-[#444] transition-all"
            onClick={handleIncrement}
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Target Team Selection (Mobile only) */}
      <div className="w-full md:hidden">
        <TeamSelectPopup teams={teams} />
      </div>

      {/* Sell Target Information */}
      <div className="w-full flex flex-col">
        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono tracking-widest uppercase mb-2 px-1">
          <span>Target Franchise</span>
          {selectedTeamId ? (
            <span className="text-accent-gold">
              {selectedTeam?.shortCode} selected
            </span>
          ) : (
            <span className="text-rose-500/80">None Selected</span>
          )}
        </div>

        {/* Sell Button */}
        <button
          className="w-full h-16 text-xl font-bold uppercase tracking-widest bg-white text-black hover:bg-[#e0e0e0] transition-colors rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSell}
          disabled={
            sellMutation.isPending || nextMutation.isPending || !selectedTeamId
          }
        >
          <Gavel className="w-5 h-5 mr-3" />
          {sellMutation.isPending ? "Selling..." : "Sell Player"}
        </button>
      </div>

      {/* Pass / Next Controls */}
      <div className="flex w-full gap-3 mt-2">
        <button
          className="flex-1 h-12 flex items-center justify-center bg-transparent border border-[#333] hover:bg-[#1a1a1a] text-slate-500 rounded-xl uppercase tracking-wider font-bold text-xs transition-colors cursor-not-allowed"
          disabled
        >
          <Rewind className="w-4 h-4 mr-2" />
          Undo
        </button>

        <button
          className="flex-1 h-12 flex items-center justify-center bg-transparent border border-[#333] hover:bg-[#1a1a1a] text-slate-300 hover:text-white hover:border-[#555] rounded-xl uppercase tracking-wider font-bold text-xs transition-colors"
          onClick={handleNext}
          disabled={sellMutation.isPending || nextMutation.isPending}
        >
          Pass / Next
          <FastForward className="w-4 h-4 ml-2" />
        </button>
      </div>

      {/* Previous Player Log */}
      <div className="w-full pt-6 border-t border-[#222] mt-4 flex flex-col items-center">
        <div className="flex items-center text-[#555] text-[10px] uppercase font-mono tracking-widest mb-3">
          <History className="w-3 h-3 mr-2" /> Previous Transaction
        </div>

        {previousTransaction ? (
          <div className="w-full bg-[#111] border border-[#222] rounded-xl p-4 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-200">
                {previousTransaction.player.name}
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs">
                <span>Sold to</span>
                <span className="flex items-center gap-1 font-medium text-slate-300">
                  <TeamLogo
                    domain={previousTransaction.team.domain}
                    name={previousTransaction.team.name}
                    size={14}
                  />
                  {previousTransaction.team.shortCode}
                </span>
              </div>
            </div>
            <span className="font-mono text-lg font-bold text-white">
              ♦ {previousTransaction.amount}
            </span>
          </div>
        ) : (
          <div className="w-full bg-transparent border border-[#222] border-dashed rounded-xl p-4 flex items-center justify-center">
            <span className="text-[#444] font-mono text-xs uppercase tracking-widest">
              No recent logs
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
