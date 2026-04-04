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
  acknowledgeMutate: vi.fn(),
  nextPending: false,
  nextError: false,
  acknowledgePending: false,
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
}));

describe("AuctionLayout iteration dialogs", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    hookState.nextMutate.mockReset();
    hookState.acknowledgeMutate.mockReset();
    hookState.teams = [];
    hookState.players = [];
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
});
