// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuctionLayout } from "@/components/auction/AuctionLayout";
import type { CurrentPlayerState, Player, Team } from "@/types";

const hookState = vi.hoisted(() => ({
  teams: [] as Team[],
  players: [] as Player[],
  current: {
    player: null,
    isComplete: false,
    restartAckRequired: false,
    unsoldIterationRound: 1,
    isAuctionEnded: false,
    auctionEndReason: null,
  } as CurrentPlayerState,
  nextMutate: vi.fn(),
  sellMutate: vi.fn(),
  focusMutate: vi.fn(),
  undoMutate: vi.fn(),
  acknowledgeMutate: vi.fn(),
  nextPending: false,
  sellPending: false,
  focusPending: false,
  undoPending: false,
  nextError: false,
  acknowledgePending: false,
  previousEntry: null as unknown,
}));

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="user-button" />,
}));

vi.mock("@/hooks/useAuction", () => ({
  useTeams: () => ({
    data: hookState.teams,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  usePlayers: () => ({
    data: hookState.players,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCurrentPlayer: () => ({
    data: hookState.current,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useAuctionLog: () => ({
    data: [],
  }),
  useNextPlayer: () => ({
    mutate: hookState.nextMutate,
    isPending: hookState.nextPending,
    isError: hookState.nextError,
  }),
  useAcknowledgeAuctionRestart: () => ({
    mutate: hookState.acknowledgeMutate,
    isPending: hookState.acknowledgePending,
  }),
  useSellPlayer: () => ({
    mutate: hookState.sellMutate,
    isPending: hookState.sellPending,
  }),
  useFocusPlayer: () => ({
    mutate: hookState.focusMutate,
    isPending: hookState.focusPending,
  }),
  useUndoTransaction: () => ({
    mutate: hookState.undoMutate,
    isPending: hookState.undoPending,
  }),
  usePreviousPlayerPreview: () => ({
    data: hookState.previousEntry,
  }),
}));

describe("AuctionLayout iteration dialogs", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    hookState.nextMutate.mockReset();
    hookState.sellMutate.mockReset();
    hookState.focusMutate.mockReset();
    hookState.undoMutate.mockReset();
    hookState.acknowledgeMutate.mockReset();
    hookState.teams = [];
    hookState.players = [];
    hookState.previousEntry = null;
    hookState.current = {
      player: null,
      isComplete: false,
      restartAckRequired: false,
      unsoldIterationRound: 1,
      isAuctionEnded: false,
      auctionEndReason: null,
    };
  });

  it("shows mandatory restart popup with exact message and OK action", async () => {
    hookState.current = {
      player: null,
      isComplete: false,
      restartAckRequired: true,
      unsoldIterationRound: 2,
      isAuctionEnded: false,
      auctionEndReason: null,
    };

    render(<AuctionLayout />);

    expect(screen.getByText("Auction Iteration Restart")).toBeTruthy();
    expect(
      screen.getByText(
        /Iterated through all unsold players once\.\s*Restarting from the first unsold player again/i,
      ),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(hookState.acknowledgeMutate).toHaveBeenCalledTimes(1);
    expect(hookState.nextMutate).not.toHaveBeenCalled();
  });

  it("shows final completion prompt and all-players navigation CTA", () => {
    hookState.current = {
      player: null,
      isComplete: true,
      restartAckRequired: false,
      unsoldIterationRound: 2,
      isAuctionEnded: true,
      auctionEndReason: "ITERATION_LIMIT_REACHED",
    };

    render(<AuctionLayout />);

    expect(
      screen.getByText(
        "Auction is ended, Iterated through unsold players twice.",
      ),
    ).toBeTruthy();

    const navLink = screen.getByRole("link", {
      name: "Navigate to All Players",
    });

    expect(navLink.getAttribute("href")).toBe("/v1/public/players");
  });

  it("uses progression next when sold preview is active", async () => {
    const soldPreviewPlayer: Player = {
      id: "p-sold",
      name: "Sold Preview",
      position1: "FORWARD",
      basePrice: 10,
      status: "SOLD",
    };

    hookState.teams = [
      {
        id: "t1",
        name: "Team One",
        shortCode: "ONE",
        domain: "one.example",
        pointsTotal: 1000,
        pointsSpent: 0,
        pointsRemaining: 1000,
        playersOwnedCount: 0,
        sessionId: "session-1",
        players: [],
        transactions: [],
      },
    ];
    hookState.players = [soldPreviewPlayer];
    hookState.current = {
      player: soldPreviewPlayer,
      isComplete: false,
      restartAckRequired: false,
      unsoldIterationRound: 1,
      isAuctionEnded: false,
      auctionEndReason: null,
    };

    render(<AuctionLayout />);

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(hookState.nextMutate).toHaveBeenCalledTimes(1);
  });
});
