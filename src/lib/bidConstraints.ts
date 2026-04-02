import {
  AUCTION_MANDATORY_PLAYER_SLOTS,
  PLAYER_BASE_PRICE,
} from "@/lib/constants";

export interface TeamBidConstraintInput {
  pointsRemaining: number;
  playersOwnedCount: number;
  mandatoryAuctionSlots?: number;
  basePrice?: number;
}

export interface TeamBidConstraints {
  pointsRemaining: number;
  playersOwnedCount: number;
  mandatoryAuctionSlots: number;
  basePrice: number;
  canBuyAnotherPlayer: boolean;
  remainingSlotsAfterPurchase: number;
  reservePointsRequired: number;
  maxAllowedBid: number;
  canAffordMinimumBid: boolean;
}

function normalizeNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : 0;
}

function pluralizePlayers(count: number): string {
  return count === 1 ? "player" : "players";
}

export function calculateTeamBidConstraints({
  pointsRemaining,
  playersOwnedCount,
  mandatoryAuctionSlots = AUCTION_MANDATORY_PLAYER_SLOTS,
  basePrice = PLAYER_BASE_PRICE,
}: TeamBidConstraintInput): TeamBidConstraints {
  const normalizedPointsRemaining =
    normalizeNonNegativeInteger(pointsRemaining);
  const normalizedPlayersOwnedCount =
    normalizeNonNegativeInteger(playersOwnedCount);
  const normalizedMandatoryAuctionSlots = Math.max(
    1,
    normalizeNonNegativeInteger(mandatoryAuctionSlots),
  );
  const normalizedBasePrice = Math.max(
    1,
    normalizeNonNegativeInteger(basePrice),
  );

  const canBuyAnotherPlayer =
    normalizedPlayersOwnedCount < normalizedMandatoryAuctionSlots;
  const remainingSlotsAfterPurchase = canBuyAnotherPlayer
    ? Math.max(
        0,
        normalizedMandatoryAuctionSlots - (normalizedPlayersOwnedCount + 1),
      )
    : 0;

  const reservePointsRequired =
    remainingSlotsAfterPurchase * normalizedBasePrice;
  const maxAllowedBid = normalizedPointsRemaining - reservePointsRequired;

  return {
    pointsRemaining: normalizedPointsRemaining,
    playersOwnedCount: normalizedPlayersOwnedCount,
    mandatoryAuctionSlots: normalizedMandatoryAuctionSlots,
    basePrice: normalizedBasePrice,
    canBuyAnotherPlayer,
    remainingSlotsAfterPurchase,
    reservePointsRequired,
    maxAllowedBid,
    canAffordMinimumBid:
      canBuyAnotherPlayer && maxAllowedBid >= normalizedBasePrice,
  };
}

export function getBidValidationError(
  constraints: TeamBidConstraints,
  bidAmount: number,
): string | null {
  if (!constraints.canBuyAnotherPlayer) {
    return `Team already has ${constraints.mandatoryAuctionSlots} auction players and cannot buy more.`;
  }

  if (
    !Number.isFinite(bidAmount) ||
    !Number.isInteger(bidAmount) ||
    bidAmount <= 0
  ) {
    return "Invalid bid amount.";
  }

  if (bidAmount < constraints.basePrice) {
    return `Bid must be at least ${constraints.basePrice} points.`;
  }

  if (!constraints.canAffordMinimumBid) {
    return `Team must reserve ${constraints.reservePointsRequired} points for ${constraints.remainingSlotsAfterPurchase} remaining auction ${pluralizePlayers(constraints.remainingSlotsAfterPurchase)} and cannot place a valid bid right now.`;
  }

  if (bidAmount > constraints.maxAllowedBid) {
    return `Max allowed bid is ${constraints.maxAllowedBid} points to reserve ${constraints.reservePointsRequired} points for ${constraints.remainingSlotsAfterPurchase} remaining auction ${pluralizePlayers(constraints.remainingSlotsAfterPurchase)}.`;
  }

  return null;
}

export function isBidAmountAllowed(
  constraints: TeamBidConstraints,
  bidAmount: number,
): boolean {
  return getBidValidationError(constraints, bidAmount) === null;
}
