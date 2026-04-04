import { describe, expect, it } from "vitest";
import { advanceToNextPlayer } from "@/lib/auctionProgression";
import {
  buildActiveSession,
  buildPlayer,
  createInMemorySupabase,
} from "../utils/inMemorySupabase";

type ProgressionClient = Parameters<typeof advanceToNextPlayer>[0];

describe("auction progression module", () => {
  it("advances to the next unsold player relative to current IN_AUCTION", async () => {
    const supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Player: [
        buildPlayer({
          id: "p1",
          name: "A",
          importOrder: 1,
          status: "IN_AUCTION",
        }),
        buildPlayer({
          id: "p2",
          name: "B",
          importOrder: 2,
          status: "UNSOLD",
        }),
        buildPlayer({
          id: "p3",
          name: "C",
          importOrder: 3,
          status: "UNSOLD",
        }),
      ],
    });

    const result = await advanceToNextPlayer(
      supabase as unknown as ProgressionClient,
      "session-1",
      {
        referencePlayerId: "p1",
      },
    );

    expect(result.nextPlayer?.id).toBe("p2");
    expect(result.didWrap).toBe(false);
    expect(result.restartAckRequired).toBe(false);
    expect(result.currentRound).toBe(1);

    const players = supabase.state.Player;
    expect(players.find((player) => player.id === "p1")?.status).toBe("UNSOLD");
    expect(players.find((player) => player.id === "p2")?.status).toBe(
      "IN_AUCTION",
    );

    const session = supabase.state.AuctionSession[0];
    expect(session.unsoldIterationAnchorPlayerId).toBe("p1");
    expect(session.unsoldIterationRound).toBe(1);
    expect(session.restartAckRequired).toBe(false);
  });

  it("marks restart acknowledgment required when first full unsold wrap completes", async () => {
    const supabase = createInMemorySupabase({
      AuctionSession: [
        buildActiveSession({
          unsoldIterationRound: 1,
          unsoldIterationAnchorPlayerId: "p1",
        }),
      ],
      Player: [
        buildPlayer({
          id: "p1",
          name: "Anchor",
          importOrder: 1,
          status: "SOLD",
        }),
        buildPlayer({
          id: "p2",
          name: "Unsold",
          importOrder: 2,
          status: "UNSOLD",
        }),
        buildPlayer({
          id: "p3",
          name: "Current",
          importOrder: 3,
          status: "IN_AUCTION",
        }),
      ],
    });

    const result = await advanceToNextPlayer(
      supabase as unknown as ProgressionClient,
      "session-1",
      {
        referencePlayerId: "p3",
      },
    );

    expect(result.didWrap).toBe(true);
    expect(result.restartedFromAnchor).toBe(true);
    expect(result.restartAckRequired).toBe(true);
    expect(result.currentRound).toBe(2);
    expect(result.nextPlayer?.id).toBe("p2");

    const session = supabase.state.AuctionSession[0];
    expect(session.unsoldIterationRound).toBe(2);
    expect(session.restartAckRequired).toBe(true);
    expect(session.isAuctionEnded).toBe(false);
  });

  it("ends auction on second-wrap completion", async () => {
    const supabase = createInMemorySupabase({
      AuctionSession: [
        buildActiveSession({
          unsoldIterationRound: 2,
          unsoldIterationAnchorPlayerId: "p1",
        }),
      ],
      Player: [
        buildPlayer({ id: "p1", importOrder: 1, status: "UNSOLD" }),
        buildPlayer({ id: "p2", importOrder: 2, status: "SOLD" }),
        buildPlayer({ id: "p3", importOrder: 3, status: "IN_AUCTION" }),
      ],
    });

    const result = await advanceToNextPlayer(
      supabase as unknown as ProgressionClient,
      "session-1",
      {
        referencePlayerId: "p3",
      },
    );

    expect(result.didWrap).toBe(true);
    expect(result.auctionEnded).toBe(true);
    expect(result.endReason).toBe("ITERATION_LIMIT_REACHED");
    expect(result.nextPlayer).toBeNull();

    const session = supabase.state.AuctionSession[0];
    expect(session.isAuctionEnded).toBe(true);
    expect(session.auctionEndReason).toBe("ITERATION_LIMIT_REACHED");
    expect(session.restartAckRequired).toBe(false);

    const liveCount = supabase.state.Player.filter(
      (player) => player.status === "IN_AUCTION",
    ).length;
    expect(liveCount).toBe(0);
  });

  it("ends with UNSOLD_DEPLETED when no unsold players remain", async () => {
    const supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Player: [
        buildPlayer({ id: "p1", importOrder: 1, status: "SOLD" }),
        buildPlayer({ id: "p2", importOrder: 2, status: "SOLD" }),
      ],
    });

    const result = await advanceToNextPlayer(
      supabase as unknown as ProgressionClient,
      "session-1",
      {
        referencePlayerId: "p1",
      },
    );

    expect(result.auctionEnded).toBe(true);
    expect(result.endReason).toBe("UNSOLD_DEPLETED");
    expect(result.nextPlayer).toBeNull();

    const session = supabase.state.AuctionSession[0];
    expect(session.isAuctionEnded).toBe(true);
    expect(session.auctionEndReason).toBe("UNSOLD_DEPLETED");
  });

  it("returns existing terminal state without mutating live player selection", async () => {
    const supabase = createInMemorySupabase({
      AuctionSession: [
        buildActiveSession({
          isAuctionEnded: true,
          auctionEndReason: "ITERATION_LIMIT_REACHED",
          unsoldIterationRound: 2,
        }),
      ],
      Player: [
        buildPlayer({ id: "p1", importOrder: 1, status: "IN_AUCTION" }),
        buildPlayer({ id: "p2", importOrder: 2, status: "UNSOLD" }),
      ],
    });

    const result = await advanceToNextPlayer(
      supabase as unknown as ProgressionClient,
      "session-1",
      {
        referencePlayerId: "p1",
      },
    );

    expect(result.auctionEnded).toBe(true);
    expect(result.endReason).toBe("ITERATION_LIMIT_REACHED");
    expect(result.nextPlayer).toBeNull();

    expect(
      supabase.state.Player.find((player) => player.id === "p1")?.status,
    ).toBe("IN_AUCTION");
    expect(
      supabase.state.Player.find((player) => player.id === "p2")?.status,
    ).toBe("UNSOLD");
  });
});
