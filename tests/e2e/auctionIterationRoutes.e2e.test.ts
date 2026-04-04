import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as resetAuctionPost } from "@/app/api/admin/auction/reset/route";
import { POST as nextPlayerPost } from "@/app/api/auction/next/route";
import { POST as restartAckPost } from "@/app/api/auction/restart-ack/route";
import { POST as sellPlayerPost } from "@/app/api/auction/sell/route";
import { GET as currentPlayerGet } from "@/app/api/players/current/route";
import {
  buildActionHistory,
  buildActiveSession,
  buildPlayer,
  buildTeam,
  buildTransaction,
  createInMemorySupabase,
} from "../utils/inMemorySupabase";

type InMemoryClient = ReturnType<typeof createInMemorySupabase>;

const mockContext = vi.hoisted(() => ({
  supabase: null as InMemoryClient | null,
}));

const authMocks = vi.hoisted(() => ({
  requireAuctionAccess: vi.fn(async () => null),
  requireSuperAdmin: vi.fn(async () => null),
  requireCurrentUserPassword: vi.fn(async () => null),
}));

vi.mock("@/lib/auth", () => authMocks);

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: () => {
    if (!mockContext.supabase) {
      throw new Error("Supabase test context was not initialized");
    }

    return mockContext.supabase;
  },
}));

describe("auction route end-to-end flow", () => {
  beforeEach(() => {
    mockContext.supabase = null;
  });

  it("runs a full two-pass cycle with mandatory restart acknowledgment and final end", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Player: [
        buildPlayer({
          id: "p1",
          name: "A",
          importOrder: 1,
          status: "IN_AUCTION",
        }),
        buildPlayer({ id: "p2", name: "B", importOrder: 2, status: "UNSOLD" }),
      ],
    });

    const pass1 = await nextPlayerPost();
    expect(pass1.status).toBe(200);
    const pass1Body = await pass1.json();
    expect(pass1Body.data.nextPlayer.id).toBe("p2");
    expect(pass1Body.data.progression.currentRound).toBe(1);

    const pass2 = await nextPlayerPost();
    expect(pass2.status).toBe(200);
    const pass2Body = await pass2.json();
    expect(pass2Body.data.progression.restartAckRequired).toBe(true);
    expect(pass2Body.data.progression.currentRound).toBe(2);

    const blockedBeforeAck = await nextPlayerPost();
    expect(blockedBeforeAck.status).toBe(409);
    const blockedBody = await blockedBeforeAck.json();
    expect(blockedBody.code).toBe("RESTART_ACK_REQUIRED");

    const ackRes = await restartAckPost();
    expect(ackRes.status).toBe(200);
    const ackBody = await ackRes.json();
    expect(ackBody.data.acknowledged).toBe(true);

    const round2Step1 = await nextPlayerPost();
    expect(round2Step1.status).toBe(200);
    const round2Step1Body = await round2Step1.json();
    expect(round2Step1Body.data.progression.currentRound).toBe(2);
    expect(round2Step1Body.data.progression.auctionEnded).toBe(false);

    const round2Step2 = await nextPlayerPost();
    expect(round2Step2.status).toBe(200);
    const round2Step2Body = await round2Step2.json();
    expect(round2Step2Body.data.progression.auctionEnded).toBe(true);
    expect(round2Step2Body.data.progression.endReason).toBe(
      "ITERATION_LIMIT_REACHED",
    );
    expect(round2Step2Body.data.nextPlayer).toBeNull();

    const currentRes = await currentPlayerGet();
    expect(currentRes.status).toBe(200);
    const currentBody = await currentRes.json();
    expect(currentBody.meta.isComplete).toBe(true);
    expect(currentBody.meta.isAuctionEnded).toBe(true);
    expect(currentBody.meta.auctionEndReason).toBe("ITERATION_LIMIT_REACHED");

    expect(mockContext.supabase.state.AuctionActionHistory).toHaveLength(4);
    expect(
      mockContext.supabase.state.AuctionActionHistory.at(-1)?.toPlayerId,
    ).toBeNull();
  });

  it("blocks sell while restart acknowledgment is pending", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession({ restartAckRequired: true })],
      Player: [buildPlayer({ id: "p1", importOrder: 1, status: "IN_AUCTION" })],
      Team: [
        buildTeam({
          id: "t1",
          pointsTotal: 1000,
          pointsSpent: 0,
        }),
      ],
    });

    const sellRes = await sellPlayerPost(
      new Request("http://localhost/api/auction/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: "p1",
          teamId: "t1",
          amount: 10,
        }),
      }) as unknown as Parameters<typeof sellPlayerPost>[0],
    );

    expect(sellRes.status).toBe(409);
    const body = await sellRes.json();
    expect(body.code).toBe("RESTART_ACK_REQUIRED");
    expect(mockContext.supabase.state.Transaction).toHaveLength(0);
  });

  it("returns current player metadata for restart/round state", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [
        buildActiveSession({
          unsoldIterationRound: 2,
          restartAckRequired: true,
        }),
      ],
      Player: [
        buildPlayer({ id: "p1", status: "IN_AUCTION", importOrder: 1 }),
        buildPlayer({ id: "p2", status: "UNSOLD", importOrder: 2 }),
      ],
    });

    const res = await currentPlayerGet();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.meta.restartAckRequired).toBe(true);
    expect(body.meta.unsoldIterationRound).toBe(2);
    expect(body.meta.isAuctionEnded).toBe(false);
    expect(body.meta.isComplete).toBe(false);
    expect(body.data.id).toBe("p1");
  });

  it("does not auto-advance after sell and keeps sold player visible as current preview", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Player: [
        buildPlayer({ id: "p1", importOrder: 1, status: "IN_AUCTION" }),
        buildPlayer({ id: "p2", importOrder: 2, status: "UNSOLD" }),
      ],
      Team: [
        buildTeam({
          id: "t1",
          pointsTotal: 1000,
          pointsSpent: 0,
        }),
      ],
    });

    const sellRes = await sellPlayerPost(
      new Request("http://localhost/api/auction/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: "p1",
          teamId: "t1",
          amount: 10,
        }),
      }) as unknown as Parameters<typeof sellPlayerPost>[0],
    );

    expect(sellRes.status).toBe(200);
    const sellBody = await sellRes.json();
    expect(sellBody.data.nextPlayer).toBeNull();
    expect(sellBody.data.progression.auctionEnded).toBe(false);

    const livePlayers = mockContext.supabase.state.Player.filter(
      (player) => player.status === "IN_AUCTION",
    );
    expect(livePlayers).toHaveLength(0);

    const soldPlayer = mockContext.supabase.state.Player.find(
      (player) => player.id === "p1",
    );
    expect(soldPlayer?.status).toBe("SOLD");

    const latestHistory =
      mockContext.supabase.state.AuctionActionHistory.at(-1);
    expect(latestHistory?.actionType).toBe("SELL");
    expect(latestHistory?.toPlayerId).toBeNull();

    const currentRes = await currentPlayerGet();
    expect(currentRes.status).toBe(200);
    const currentBody = await currentRes.json();
    expect(currentBody.data.id).toBe("p1");
    expect(currentBody.data.status).toBe("SOLD");
    expect(currentBody.meta.isComplete).toBe(false);
  });

  it("uses latest action history as next reference when no IN_AUCTION player exists", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Player: [
        buildPlayer({ id: "p1", importOrder: 1, status: "SOLD" }),
        buildPlayer({ id: "p2", importOrder: 2, status: "UNSOLD" }),
        buildPlayer({ id: "p3", importOrder: 3, status: "UNSOLD" }),
      ],
      AuctionActionHistory: [
        buildActionHistory({
          id: "h-sell",
          actionType: "SELL",
          fromPlayerId: "p1",
          toPlayerId: null,
        }),
      ],
    });

    const nextRes = await nextPlayerPost();
    expect(nextRes.status).toBe(200);
    const nextBody = await nextRes.json();

    expect(nextBody.data.nextPlayer.id).toBe("p2");
    expect(nextBody.data.progression.didWrap).toBe(false);

    const promotedPlayer = mockContext.supabase.state.Player.find(
      (player) => player.id === "p2",
    );
    expect(promotedPlayer?.status).toBe("IN_AUCTION");
  });

  it("resets auction data and iteration state via admin reset route", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [
        buildActiveSession({
          unsoldIterationRound: 2,
          unsoldIterationAnchorPlayerId: "p1",
          restartAckRequired: true,
          isAuctionEnded: true,
          auctionEndReason: "ITERATION_LIMIT_REACHED",
          endedAt: "2026-04-04T01:00:00.000Z",
        }),
      ],
      Player: [
        buildPlayer({ id: "p1", status: "SOLD", teamId: "t1", importOrder: 1 }),
        buildPlayer({
          id: "p2",
          status: "IN_AUCTION",
          teamId: null,
          importOrder: 2,
        }),
      ],
      Team: [buildTeam({ id: "t1", pointsSpent: 440 })],
      Transaction: [
        buildTransaction({
          id: "tx1",
          playerId: "p1",
          teamId: "t1",
          amount: 440,
        }),
      ],
      AuctionActionHistory: [
        buildActionHistory({
          id: "h1",
          fromPlayerId: "p1",
          transactionId: "tx1",
        }),
      ],
    });

    const res = await resetAuctionPost(
      new Request("http://localhost/api/admin/auction/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "secret" }),
      }) as unknown as Parameters<typeof resetAuctionPost>[0],
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const session = mockContext.supabase.state.AuctionSession[0];
    expect(session.unsoldIterationRound).toBe(1);
    expect(session.unsoldIterationAnchorPlayerId).toBeNull();
    expect(session.restartAckRequired).toBe(false);
    expect(session.isAuctionEnded).toBe(false);
    expect(session.auctionEndReason).toBeNull();
    expect(session.endedAt).toBeNull();

    expect(mockContext.supabase.state.Transaction).toHaveLength(0);
    expect(mockContext.supabase.state.AuctionActionHistory).toHaveLength(0);
    expect(mockContext.supabase.state.Team[0].pointsSpent).toBe(0);
    expect(
      mockContext.supabase.state.Player.every(
        (player) => player.status === "UNSOLD" && player.teamId === null,
      ),
    ).toBe(true);

    expect(body.data.playerOrder).toBeTruthy();
    expect(body.data.playerOrder.reorderedPlayers).toBe(2);
  });

  it("reorders players on reset with fixed CSV tails appended per role", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Team: [buildTeam({ id: "t1", pointsSpent: 220 })],
      Player: [
        buildPlayer({
          id: "gk1",
          name: "Goalkeeper One",
          position1: "GK",
          importOrder: 0,
          status: "SOLD",
          teamId: "t1",
        }),
        buildPlayer({
          id: "gk2",
          name: "Goalkeeper Two",
          position1: "GK",
          importOrder: 1,
          status: "UNSOLD",
        }),
        buildPlayer({
          id: "f1",
          name: "Random Forward A",
          position1: "FORWARD",
          importOrder: 2,
          status: "UNSOLD",
        }),
        buildPlayer({
          id: "f2",
          name: "Random Forward B",
          position1: "FORWARD",
          importOrder: 3,
          status: "UNSOLD",
        }),
        buildPlayer({
          id: "f3",
          name: "Rupam Palui",
          position1: "FORWARD",
          importOrder: 4,
          status: "SOLD",
          teamId: "t1",
        }),
        buildPlayer({
          id: "f4",
          name: "Abhirup Dey",
          position1: "FORWARD",
          importOrder: 5,
          status: "UNSOLD",
        }),
      ],
      Transaction: [
        buildTransaction({
          id: "tx-fixed-tail",
          playerId: "f3",
          teamId: "t1",
          amount: 220,
        }),
      ],
      AuctionActionHistory: [
        buildActionHistory({
          id: "hist-fixed-tail",
          fromPlayerId: "f3",
          transactionId: "tx-fixed-tail",
        }),
      ],
    });

    const res = await resetAuctionPost(
      new Request("http://localhost/api/admin/auction/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "secret" }),
      }) as unknown as Parameters<typeof resetAuctionPost>[0],
    );

    expect(res.status).toBe(200);

    const orderedPlayers = [...mockContext.supabase.state.Player].sort(
      (a, b) =>
        Number(a.importOrder ?? Number.MAX_SAFE_INTEGER) -
        Number(b.importOrder ?? Number.MAX_SAFE_INTEGER),
    );

    const orderedForwardNames = orderedPlayers
      .filter((player) => player.position1 === "FORWARD")
      .map((player) => String(player.name));

    expect(orderedForwardNames).toHaveLength(4);
    expect(orderedForwardNames.slice(-2)).toEqual([
      "Rupam Palui",
      "Abhirup Dey",
    ]);

    const gkLastIndex = orderedPlayers.reduce((lastIndex, player, index) => {
      if (player.position1 === "GK") {
        return index;
      }

      return lastIndex;
    }, -1);
    const firstForwardIndex = orderedPlayers.findIndex(
      (player) => player.position1 === "FORWARD",
    );

    expect(gkLastIndex).toBeGreaterThanOrEqual(0);
    expect(firstForwardIndex).toBeGreaterThan(gkLastIndex);

    expect(
      orderedPlayers.every(
        (player) => player.status === "UNSOLD" && player.teamId === null,
      ),
    ).toBe(true);
  });

  it("restart-ack route returns semantic responses for already-acked and ended sessions", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [
        buildActiveSession({
          restartAckRequired: false,
          unsoldIterationRound: 2,
        }),
      ],
    });

    const alreadyAcked = await restartAckPost();
    expect(alreadyAcked.status).toBe(200);
    const alreadyAckedBody = await alreadyAcked.json();
    expect(alreadyAckedBody.data.acknowledged).toBe(false);
    expect(alreadyAckedBody.data.reason).toBe("ALREADY_ACKNOWLEDGED");

    mockContext.supabase.state.AuctionSession[0].isAuctionEnded = true;

    const ended = await restartAckPost();
    expect(ended.status).toBe(200);
    const endedBody = await ended.json();
    expect(endedBody.data.acknowledged).toBe(false);
    expect(endedBody.data.reason).toBe("AUCTION_ENDED");
  });
});
