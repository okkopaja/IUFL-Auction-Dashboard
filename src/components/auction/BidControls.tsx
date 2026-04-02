"use client";

import { FastForward, Gavel, History, Rewind, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useGoPrevious,
  useNextPlayer,
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
  const [isViewingSoldPreview, setIsViewingSoldPreview] = useState(false);

  const sellMutation = useSellPlayer();
  const nextMutation = useNextPlayer();
  const previousMutation = useGoPrevious();
  const undoMutation = useUndoTransaction();
  const {
    data: previousEntry,
    isFetching: isLoadingPreviousEntry,
    isError: hasPreviousEntryError,
  } = usePreviousPlayerPreview();

  const isPreviewMode = isViewingSoldPreview && Boolean(previousEntry);
  const isSoldPreview =
    isPreviewMode &&
    previousEntry?.actionType === "SELL" &&
    Boolean(previousEntry.transaction);
  const isMutatingAction =
    sellMutation.isPending ||
    nextMutation.isPending ||
    previousMutation.isPending ||
    undoMutation.isPending;

  useEffect(() => {
    if (!previousEntry && isViewingSoldPreview) {
      setIsViewingSoldPreview(false);
    }
  }, [isViewingSoldPreview, previousEntry]);

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
    isMutatingAction ||
    isPreviewMode ||
    !selectedTeamId ||
    !selectedTeam ||
    Boolean(currentBidValidationError);

  const reserveHelperText = isPreviewMode
    ? "Viewing sold player preview. Use Undo to make this player actionable again."
    : selectedTeamConstraints
      ? currentBidValidationError
        ? currentBidValidationError
        : `Max bid ${selectedTeamConstraints.maxAllowedBid} points. Reserve ${selectedTeamConstraints.reservePointsRequired} for ${selectedTeamConstraints.remainingSlotsAfterPurchase} remaining auction ${selectedTeamConstraints.remainingSlotsAfterPurchase === 1 ? "player" : "players"}.`
      : "Select a team to see bid limit.";

  const handleSell = () => {
    if (isPreviewMode) {
      toast.error("Return to live auction before selling.");
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
      { playerId: player.id, teamId: selectedTeamId, amount: currentBid },
      {
        onSuccess: () => {
          toast.success(
            `${player.name} sold to ${selectedTeam?.name} for ${currentBid}`,
          );
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
    if (isPreviewMode) {
      setIsViewingSoldPreview(false);
      return;
    }

    nextMutation.mutate(undefined, {
      onError: () => {
        toast.error("Error moving to next player");
      },
    });
  };

  const handlePrevious = () => {
    if (isViewingSoldPreview) {
      setIsViewingSoldPreview(false);
      return;
    }

    if (hasPreviousEntryError) {
      toast.error("Could not load previous player.");
      return;
    }

    if (!previousEntry) {
      toast.error("No previous player available yet.");
      return;
    }

    previousMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.mode === "SELL_PREVIEW") {
          setIsViewingSoldPreview(true);
          return;
        }

        setIsViewingSoldPreview(false);
        toast.success("Moved back to the previous unsold player.");
      },
      onError: (err: unknown) => {
        const errorMessage =
          typeof err === "object" &&
          err !== null &&
          typeof (err as ApiErrorShape).response?.data?.error === "string"
            ? (err as ApiErrorShape).response?.data?.error
            : "Error moving to previous action";

        toast.error(errorMessage);
      },
    });
  };

  const handleUndo = () => {
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
                isMutatingAction ||
                isPreviewMode ||
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
                isPreviewMode ||
                currentBid <= AUCTION_START_BID ||
                isMutatingAction
              }
            >
              -{decrement}
            </button>
          ))}
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
        {isSoldPreview && previousEntry?.transaction ? (
          <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
            <div className="-rotate-24 border-4 border-rose-600/90 bg-rose-950/15 px-8 py-2 text-6xl font-black uppercase tracking-[0.2em] text-rose-500/95 [text-shadow:0_0_28px_rgba(244,63,94,0.45)]">
              SOLD
            </div>
            <div className="mt-12 rounded-lg border border-rose-500/40 bg-black/85 px-4 py-2 text-center">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-400">
                Sold To
              </p>
              <div className="mt-1 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-rose-300">
                <TeamLogo
                  domain={previousEntry.transaction.team.domain}
                  name={previousEntry.transaction.team.name}
                  size={16}
                />
                <span>{previousEntry.transaction.team.shortCode}</span>
                <span className="text-slate-500">|</span>
                <span>{previousEntry.transaction.amount}</span>
              </div>
            </div>
          </div>
        ) : null}

        <div className={isSoldPreview ? "opacity-30" : "opacity-100"}>
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
                disabled={
                  isLoadingPreviousEntry ||
                  previousMutation.isPending ||
                  (!previousEntry && !isViewingSoldPreview)
                }
              >
                <Rewind className="w-4 h-4 mr-2" />
                {isViewingSoldPreview ? "Back To Live" : "Previous"}
              </button>

              <button
                type="button"
                className="flex-1 h-10 flex items-center justify-center bg-transparent border border-[#333] hover:bg-[#1a1a1a] text-slate-300 hover:text-white hover:border-[#555] rounded-xl uppercase tracking-wider font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleNext}
                disabled={isMutatingAction}
              >
                Pass / Next
                <FastForward className="w-4 h-4 ml-2" />
              </button>
            </div>

            <div className="flex w-full justify-center">
              <button
                type="button"
                className="h-10 w-full max-w-60 flex items-center justify-center bg-transparent border border-[#333] hover:bg-[#1a1a1a] text-slate-300 hover:text-white hover:border-[#555] rounded-xl uppercase tracking-wider font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleUndo}
                disabled={isMutatingAction}
              >
                <Undo2 className="w-4 h-4 mr-2" />
                Undo
              </button>
            </div>
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
