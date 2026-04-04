"use client";

import { FastForward, Gavel, History, Rewind, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useFocusPlayer,
  usePreviousPlayerPreview,
  useSellPlayer,
  useUndoTransaction,
} from "@/hooks/useAuction";
import {
  calculateTeamBidConstraints,
  getBidValidationError,
} from "@/lib/bidConstraints";
import {
  AUCTION_BID_INCREMENT_OPTIONS,
  AUCTION_START_BID,
} from "@/lib/constants";
import { useAuctionStore } from "@/store/auctionStore";
import type { Player, Team, Transaction } from "@/types";
import { TeamLogo } from "../shared/TeamLogo";
import { TeamSelectPopup } from "./TeamSelectPopup";

interface ApiErrorShape {
  response?: {
    data?: {
      error?: string;
    };
  };
}

export function BidControls({
  player,
  livePlayer,
  allPlayers,
  teams,
  logs,
  controlsLocked = false,
  onBrowsePlayerChange,
  onAdvanceAuction,
  unsoldIterationRound = 1,
}: {
  player: Player;
  livePlayer: Player | null;
  allPlayers: Player[];
  teams: Team[];
  logs: Transaction[];
  controlsLocked?: boolean;
  onBrowsePlayerChange?: (playerId: string | null) => void;
  onAdvanceAuction?: () => void;
  unsoldIterationRound?: number;
}) {
  const currentBid = useAuctionStore((state) => state.currentBid);
  const selectedTeamId = useAuctionStore((state) => state.selectedTeamId);
  const setBid = useAuctionStore((state) => state.setBid);
  const [browseIndex, setBrowseIndex] = useState<number | null>(null);

  const sellMutation = useSellPlayer();
  const focusMutation = useFocusPlayer();
  const undoMutation = useUndoTransaction();
  const { data: previousEntry } = usePreviousPlayerPreview();

  const isSecondIteration = unsoldIterationRound >= 2;
  const traversalPlayers = useMemo(() => {
    if (!isSecondIteration) {
      return allPlayers;
    }

    const unsoldTraversalPool = allPlayers.filter(
      (candidate) => candidate.status !== "SOLD",
    );

    return unsoldTraversalPool.length > 0 ? unsoldTraversalPool : allPlayers;
  }, [allPlayers, isSecondIteration]);

  const liveIndex = useMemo(() => {
    if (!livePlayer) return -1;
    return traversalPlayers.findIndex(
      (candidate) => candidate.id === livePlayer.id,
    );
  }, [livePlayer, traversalPlayers]);

  const fallbackIndex = useMemo(
    () => traversalPlayers.findIndex((candidate) => candidate.id === player.id),
    [player.id, traversalPlayers],
  );

  const displayedIndex =
    browseIndex ?? (liveIndex >= 0 ? liveIndex : fallbackIndex);
  const displayedPlayer =
    displayedIndex >= 0 ? traversalPlayers[displayedIndex] : player;
  const isBrowseMode = browseIndex !== null;
  const shouldUseProgressionNext =
    !isBrowseMode && displayedPlayer.status !== "IN_AUCTION";

  const isMutatingAction =
    sellMutation.isPending || focusMutation.isPending || undoMutation.isPending;
  const isActionLocked = isMutatingAction || controlsLocked;

  useEffect(() => {
    if (browseIndex === null) {
      return;
    }

    if (browseIndex < 0 || browseIndex >= traversalPlayers.length) {
      setBrowseIndex(null);
    }
  }, [browseIndex, traversalPlayers.length]);

  useEffect(() => {
    if (!onBrowsePlayerChange) {
      return;
    }

    if (!isBrowseMode) {
      onBrowsePlayerChange(null);
      return;
    }

    onBrowsePlayerChange(displayedPlayer?.id ?? null);
  }, [displayedPlayer?.id, isBrowseMode, onBrowsePlayerChange]);

  useEffect(() => {
    if (currentBid === 0) {
      setBid(AUCTION_START_BID);
    }
  }, [currentBid, setBid]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const selectedTeamConstraints = selectedTeam
    ? calculateTeamBidConstraints({
        pointsRemaining: selectedTeam.pointsRemaining,
        playersOwnedCount: selectedTeam.playersOwnedCount,
      })
    : null;

  const selectedTeamMaxAllowedBid =
    selectedTeamConstraints?.maxAllowedBid ?? null;
  const selectedTeamCanAffordMinimumBid =
    selectedTeamConstraints?.canAffordMinimumBid ?? false;
  const currentBidValidationError = selectedTeamConstraints
    ? getBidValidationError(selectedTeamConstraints, currentBid)
    : null;

  useEffect(() => {
    if (
      !selectedTeamId ||
      selectedTeamMaxAllowedBid === null ||
      !selectedTeamCanAffordMinimumBid
    ) {
      return;
    }

    if (currentBid > selectedTeamMaxAllowedBid) {
      setBid(selectedTeamMaxAllowedBid);
    }
  }, [
    currentBid,
    selectedTeamId,
    selectedTeamCanAffordMinimumBid,
    selectedTeamMaxAllowedBid,
    setBid,
  ]);

  const handleIncrement = (amount: number) => {
    const nextBid = currentBid + amount;

    if (
      selectedTeamConstraints &&
      getBidValidationError(selectedTeamConstraints, nextBid)
    ) {
      return;
    }

    setBid(nextBid);
  };

  const handleDecrement = (amount: number) =>
    setBid(Math.max(AUCTION_START_BID, currentBid - amount));

  const isSellDisabled =
    isActionLocked ||
    displayedPlayer.status !== "IN_AUCTION" ||
    !selectedTeamId ||
    !selectedTeam ||
    Boolean(currentBidValidationError);

  const reserveHelperText = controlsLocked
    ? "Acknowledge the restart popup to continue auction actions."
    : displayedPlayer.status === "SOLD"
      ? shouldUseProgressionNext
        ? "This player is already sold and can be viewed only. Press Next to continue auction progression."
        : "This player is already sold and can be viewed only."
      : displayedPlayer.status === "UNSOLD"
        ? shouldUseProgressionNext
          ? "This player is unsold in view mode. Press Next to continue auction progression."
          : "This player is unsold. Move iterator to set this player IN_AUCTION before selling."
        : selectedTeamConstraints
          ? currentBidValidationError
            ? currentBidValidationError
            : `Max bid ${selectedTeamConstraints.maxAllowedBid} points. Reserve ${selectedTeamConstraints.reservePointsRequired} for ${selectedTeamConstraints.remainingSlotsAfterPurchase} remaining auction ${selectedTeamConstraints.remainingSlotsAfterPurchase === 1 ? "player" : "players"}.`
          : "Select a team to see bid limit.";

  const moveBrowseIndex = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= traversalPlayers.length) {
      return;
    }

    setBrowseIndex(targetIndex);
  };

  const handleSell = () => {
    if (controlsLocked) {
      toast.error("Acknowledge restart popup before selling.");
      return;
    }

    if (displayedPlayer.status !== "IN_AUCTION") {
      toast.error("Only the active IN_AUCTION player can be sold.");
      return;
    }

    if (!selectedTeamId) {
      toast.error("Please select a team from the sidebar before selling.");
      return;
    }

    if (!selectedTeam || !selectedTeamConstraints) {
      toast.error("Selected team is not available.");
      return;
    }

    const bidValidationError = getBidValidationError(
      selectedTeamConstraints,
      currentBid,
    );

    if (bidValidationError) {
      toast.error(bidValidationError);
      return;
    }

    sellMutation.mutate(
      {
        playerId: displayedPlayer.id,
        teamId: selectedTeamId,
        amount: currentBid,
      },
      {
        onSuccess: (result) => {
          setBrowseIndex(null);
          toast.success(
            `${displayedPlayer.name} sold to ${selectedTeam?.name} for ${currentBid}`,
          );

          if (result.progression.auctionEnded) {
            if (result.progression.endReason === "ITERATION_LIMIT_REACHED") {
              toast.success(
                "Auction is ended, Iterated through unsold players twice.",
              );
            } else {
              toast.success("Auction ended. No unsold players remain.");
            }
          }
        },
        onError: (err: unknown) => {
          const errorMessage =
            typeof err === "object" &&
            err !== null &&
            typeof (err as ApiErrorShape).response?.data?.error === "string"
              ? (err as ApiErrorShape).response?.data?.error
              : "Error selling player";

          toast.error(errorMessage);
        },
      },
    );
  };

  const handleNext = () => {
    if (controlsLocked) {
      toast.error("Acknowledge restart popup before continuing.");
      return;
    }

    if (shouldUseProgressionNext) {
      if (!onAdvanceAuction) {
        toast.error("Could not continue auction progression right now.");
        return;
      }

      setBrowseIndex(null);
      onAdvanceAuction();
      return;
    }

    if (displayedIndex < 0 || traversalPlayers.length === 0) {
      return;
    }

    if (displayedIndex >= traversalPlayers.length - 1) {
      toast.info("Reached last player in auction order.");
      return;
    }

    const targetIndex = displayedIndex + 1;
    const targetPlayer = traversalPlayers[targetIndex];
    if (!targetPlayer) {
      return;
    }

    moveBrowseIndex(targetIndex);
    focusMutation.mutate(
      { playerId: targetPlayer.id },
      {
        onError: () => {
          toast.error("Error moving to next player");
        },
      },
    );
  };

  const handlePrevious = () => {
    if (controlsLocked) {
      toast.error("Acknowledge restart popup before continuing.");
      return;
    }

    if (displayedIndex < 0 || traversalPlayers.length === 0) {
      toast.error("No players available for traversal.");
      return;
    }

    if (displayedIndex === 0) {
      toast.info("Reached first player in auction order.");
      return;
    }

    const targetIndex = displayedIndex - 1;
    const targetPlayer = traversalPlayers[targetIndex];
    if (!targetPlayer) {
      return;
    }

    moveBrowseIndex(targetIndex);
    focusMutation.mutate(
      { playerId: targetPlayer.id },
      {
        onError: () => {
          toast.error("Error moving to previous player");
        },
      },
    );
  };

  const handleUndo = () => {
    if (controlsLocked) {
      toast.error("Acknowledge restart popup before undoing.");
      return;
    }

    if (displayedPlayer.status !== "IN_AUCTION") {
      toast.error("Move to the active IN_AUCTION player before undoing.");
      return;
    }

    undoMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Latest sale has been undone.");
      },
      onError: (err: unknown) => {
        const errorMessage =
          typeof err === "object" &&
          err !== null &&
          typeof (err as ApiErrorShape).response?.data?.error === "string"
            ? (err as ApiErrorShape).response?.data?.error
            : "Error undoing latest sale";

        toast.error(errorMessage);
      },
    });
  };

  const previousTransaction = logs?.[0];

  return (
    <div className="z-20 flex w-full max-w-110 flex-col items-center gap-6">
      {/* Bid Display */}
      <div className="w-full flex flex-col items-center mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
          Current Bid
        </span>
        <div className="w-full flex justify-center text-8xl md:text-[9rem] leading-none font-mono font-medium text-white tracking-tighter">
          {currentBid || AUCTION_START_BID}
        </div>

        <div className="mt-4 grid w-full grid-cols-4 gap-2">
          {AUCTION_BID_INCREMENT_OPTIONS.map((increment) => (
            <button
              type="button"
              key={increment}
              className="h-10 rounded-lg bg-[#1a1a1a] border border-[#333] text-sm font-semibold text-slate-300 hover:text-white hover:bg-[#222] hover:border-[#444] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleIncrement(increment)}
              disabled={
                isActionLocked ||
                displayedPlayer.status !== "IN_AUCTION" ||
                (selectedTeamConstraints
                  ? Boolean(
                      getBidValidationError(
                        selectedTeamConstraints,
                        currentBid + increment,
                      ),
                    )
                  : false)
              }
            >
              +{increment}
            </button>
          ))}
        </div>

        <div className="mt-2 grid w-full grid-cols-4 gap-2">
          {AUCTION_BID_INCREMENT_OPTIONS.map((decrement) => (
            <button
              type="button"
              key={decrement}
              className="h-10 rounded-lg bg-[#1a1a1a] border border-[#333] text-sm font-semibold text-slate-300 hover:text-white hover:bg-[#222] hover:border-[#444] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleDecrement(decrement)}
              disabled={
                displayedPlayer.status !== "IN_AUCTION" ||
                isActionLocked ||
                currentBid <= AUCTION_START_BID ||
                controlsLocked
              }
            >
              -{decrement}
            </button>
          ))}
        </div>

        <div className="mt-2 flex w-full items-center justify-between px-1 text-[10px] font-mono uppercase tracking-[0.18em]">
          <span
            className={
              displayedPlayer.status === "IN_AUCTION"
                ? "text-emerald-300"
                : "text-amber-300"
            }
          >
            {displayedPlayer.status === "IN_AUCTION"
              ? "Live Auction"
              : "View Only"}
          </span>
          <span className="text-slate-500">{displayedPlayer.status}</span>
        </div>

        <p
          className={`mt-3 w-full text-center text-[11px] font-mono leading-relaxed ${
            currentBidValidationError ? "text-rose-400" : "text-slate-500"
          }`}
        >
          {reserveHelperText}
        </p>
      </div>

      {/* Target Team Selection (Mobile only) */}
      <div className="w-full md:hidden">
        <TeamSelectPopup teams={teams} />
      </div>

      <div className="relative w-full">
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

          <button
            type="button"
            className="w-full h-12 text-sm font-bold uppercase tracking-widest bg-white text-black hover:bg-[#e0e0e0] transition-colors rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSell}
            disabled={isSellDisabled}
          >
            <Gavel className="w-5 h-5 mr-3" />
            {sellMutation.isPending ? "Selling..." : "Sell Player"}
          </button>
        </div>

        <div className="mt-3 flex w-full flex-col gap-3">
          <div className="flex w-full gap-3">
            <button
              type="button"
              className="flex-1 h-10 flex items-center justify-center bg-transparent border border-[#333] hover:bg-[#1a1a1a] text-slate-300 hover:text-white hover:border-[#555] rounded-xl uppercase tracking-wider font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handlePrevious}
              disabled={isActionLocked || displayedIndex <= 0}
            >
              <Rewind className="w-4 h-4 mr-2" />
              Previous
            </button>

            <button
              type="button"
              className="flex-1 h-10 flex items-center justify-center bg-transparent border border-[#333] hover:bg-[#1a1a1a] text-slate-300 hover:text-white hover:border-[#555] rounded-xl uppercase tracking-wider font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleNext}
              disabled={
                isActionLocked ||
                (shouldUseProgressionNext
                  ? !onAdvanceAuction
                  : displayedIndex >= traversalPlayers.length - 1)
              }
            >
              Next
              <FastForward className="w-4 h-4 ml-2" />
            </button>
          </div>

          <div className="flex w-full justify-center">
            <button
              type="button"
              className="h-10 w-full max-w-60 flex items-center justify-center bg-transparent border border-[#333] hover:bg-[#1a1a1a] text-slate-300 hover:text-white hover:border-[#555] rounded-xl uppercase tracking-wider font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleUndo}
              disabled={
                isActionLocked || displayedPlayer.status !== "IN_AUCTION"
              }
            >
              <Undo2 className="w-4 h-4 mr-2" />
              Undo
            </button>
          </div>
        </div>
      </div>

      {/* Previous Player Log */}
      <div className="w-full pt-4 border-t border-[#222] mt-2 flex flex-col items-center">
        <div className="flex items-center text-[#555] text-[10px] uppercase font-mono tracking-widest mb-3">
          <History className="w-3 h-3 mr-2" /> Previous Player
        </div>

        {previousEntry ? (
          <div className="w-full bg-[#111] border border-[#222] rounded-xl p-4 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-200">
                {previousEntry.fromPlayer.name}
              </span>
              {previousEntry.actionType === "SELL" &&
              previousEntry.transaction ? (
                <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs">
                  <span>Sold to</span>
                  <span className="flex items-center gap-1 font-medium text-slate-300">
                    <TeamLogo
                      domain={previousEntry.transaction.team.domain}
                      name={previousEntry.transaction.team.name}
                      size={14}
                    />
                    {previousEntry.transaction.team.shortCode}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs">
                  <span>Passed</span>
                  {previousEntry.toPlayer ? (
                    <span className="text-slate-400">
                      to {previousEntry.toPlayer.name}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
            <span className="font-mono text-lg font-bold text-white">
              {previousEntry.actionType === "SELL" && previousEntry.transaction
                ? `♦ ${previousEntry.transaction.amount}`
                : "PASS"}
            </span>
          </div>
        ) : previousTransaction ? (
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
