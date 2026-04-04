// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BidControls } from "@/components/auction/BidControls";
import { useAuctionStore } from "@/store/auctionStore";
import type { Player, Team } from "@/types";

const hookState = vi.hoisted(() => ({
  focusMutate: vi.fn(),
  sellMutate: vi.fn(),
  undoMutate: vi.fn(),
  focusPending: false,
  sellPending: false,
  undoPending: false,
  previousEntry: null as unknown,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuction", () => ({
  useFocusPlayer: () => ({
    mutate: hookState.focusMutate,
    isPending: hookState.focusPending,
  }),
  useSellPlayer: () => ({
    mutate: hookState.sellMutate,
    isPending: hookState.sellPending,
  }),
  useUndoTransaction: () => ({
    mutate: hookState.undoMutate,
    isPending: hookState.undoPending,
  }),
  usePreviousPlayerPreview: () => ({
    data: hookState.previousEntry,
  }),
}));

function buildPlayer(overrides: Partial<Player>): Player {
  return {
    id: "player-default",
    name: "Player",
    position1: "GK",
    basePrice: 10,
    status: "UNSOLD",
    ...overrides,
  };
}

function buildTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "t1",
    name: "Team One",
    shortCode: "ONE",
    domain: "team-one.example",
    pointsTotal: 1000,
    pointsSpent: 0,
    pointsRemaining: 1000,
    playersOwnedCount: 0,
    sessionId: "session-1",
    players: [],
    transactions: [],
    ...overrides,
  };
}

describe("BidControls browse traversal", () => {
  const user = userEvent.setup();

  const soldPlayer = buildPlayer({
    id: "p1",
    name: "Sold One",
    status: "SOLD",
  });
  const livePlayer = buildPlayer({
    id: "p2",
    name: "Live Two",
    status: "IN_AUCTION",
  });
  const unsoldPlayer = buildPlayer({
    id: "p3",
    name: "Unsold Three",
    status: "UNSOLD",
  });
  const allPlayers: Player[] = [soldPlayer, livePlayer, unsoldPlayer];
  const teams: Team[] = [buildTeam()];

  beforeEach(() => {
    hookState.focusMutate.mockReset();
    hookState.sellMutate.mockReset();
    hookState.undoMutate.mockReset();

    useAuctionStore.setState({
      currentBid: 10,
      selectedTeamId: "t1",
      lastTransaction: null,
    });
  });

  it("traverses through sold and unsold players and focuses each selection", async () => {
    const onBrowsePlayerChange = vi.fn();

    render(
      <BidControls
        player={livePlayer}
        livePlayer={livePlayer}
        allPlayers={allPlayers}
        teams={teams}
        logs={[]}
        onBrowsePlayerChange={onBrowsePlayerChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /previous/i }));

    await waitFor(() => {
      expect(onBrowsePlayerChange).toHaveBeenLastCalledWith("p1");
    });

    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(onBrowsePlayerChange).toHaveBeenLastCalledWith("p2");
    });

    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(onBrowsePlayerChange).toHaveBeenLastCalledWith("p3");
    });

    expect(hookState.focusMutate).toHaveBeenCalledTimes(3);
    expect(hookState.focusMutate.mock.calls[0]?.[0]).toMatchObject({
      playerId: "p1",
    });
    expect(hookState.focusMutate.mock.calls[1]?.[0]).toMatchObject({
      playerId: "p2",
    });
    expect(hookState.focusMutate.mock.calls[2]?.[0]).toMatchObject({
      playerId: "p3",
    });
  });

  it("moves iterator forward from live selection", async () => {
    render(
      <BidControls
        player={livePlayer}
        livePlayer={livePlayer}
        allPlayers={allPlayers}
        teams={teams}
        logs={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(hookState.focusMutate).toHaveBeenCalledTimes(1);
    expect(hookState.focusMutate.mock.calls[0]?.[0]).toMatchObject({
      playerId: "p3",
    });
  });

  it("allows selling only when displayed player is IN_AUCTION", async () => {
    render(
      <BidControls
        player={livePlayer}
        livePlayer={livePlayer}
        allPlayers={allPlayers}
        teams={teams}
        logs={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /previous/i }));

    const sellButton = screen.getByRole("button", { name: /sell player/i });
    expect((sellButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect((sellButton as HTMLButtonElement).disabled).toBe(false);
    });

    await user.click(sellButton);

    expect(hookState.sellMutate).toHaveBeenCalledTimes(1);
    expect(hookState.sellMutate.mock.calls[0]?.[0]).toMatchObject({
      playerId: "p2",
      teamId: "t1",
      amount: 10,
    });
  });
});
