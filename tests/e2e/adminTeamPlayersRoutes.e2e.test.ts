import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  POST as addPlayerToTeamPost,
  DELETE as removePlayerFromTeamDelete,
} from "@/app/api/admin/teams/[id]/players/route";
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
  requireAdmin: vi.fn(async () => null),
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

function buildRouteContext(teamId: string) {
  return {
    params: Promise.resolve({ id: teamId }),
  } as Parameters<typeof addPlayerToTeamPost>[1];
}

describe("admin teams player management route", () => {
  beforeEach(() => {
    mockContext.supabase = null;
    authMocks.requireAdmin.mockClear();
  });

  it("adds an UNSOLD player to a team and records transaction/history", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Team: [
        buildTeam({
          id: "t1",
          pointsTotal: 1000,
          pointsSpent: 100,
        }),
      ],
      Player: [
        buildPlayer({
          id: "p1",
          name: "Unsold One",
          status: "UNSOLD",
          teamId: null,
        }),
      ],
    });

    const response = await addPlayerToTeamPost(
      new Request("http://localhost/api/admin/teams/t1/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: "p1", amount: 120 }),
      }) as unknown as Parameters<typeof addPlayerToTeamPost>[0],
      buildRouteContext("t1"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const player = mockContext.supabase.state.Player.find(
      (row) => row.id === "p1",
    );
    expect(player?.status).toBe("SOLD");
    expect(player?.teamId).toBe("t1");

    const team = mockContext.supabase.state.Team.find((row) => row.id === "t1");
    expect(team?.pointsSpent).toBe(220);

    expect(mockContext.supabase.state.Transaction).toHaveLength(1);
    const tx = mockContext.supabase.state.Transaction[0];
    expect(tx.playerId).toBe("p1");
    expect(tx.teamId).toBe("t1");
    expect(tx.amount).toBe(120);

    expect(mockContext.supabase.state.AuctionActionHistory).toHaveLength(1);
    const history = mockContext.supabase.state.AuctionActionHistory[0];
    expect(history.actionType).toBe("SELL");
    expect(history.transactionId).toBe(tx.id);
  });

  it("rejects add when player is not UNSOLD", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Team: [buildTeam({ id: "t1" })],
      Player: [
        buildPlayer({
          id: "p1",
          status: "SOLD",
          teamId: "t1",
        }),
      ],
    });

    const response = await addPlayerToTeamPost(
      new Request("http://localhost/api/admin/teams/t1/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: "p1", amount: 100 }),
      }) as unknown as Parameters<typeof addPlayerToTeamPost>[0],
      buildRouteContext("t1"),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(mockContext.supabase.state.Transaction).toHaveLength(0);
    expect(mockContext.supabase.state.AuctionActionHistory).toHaveLength(0);
  });

  it("removes a SOLD team player to UNSOLD and reverses transaction/history", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Team: [
        buildTeam({
          id: "t1",
          pointsTotal: 1000,
          pointsSpent: 350,
        }),
      ],
      Player: [
        buildPlayer({
          id: "p1",
          name: "Sold One",
          status: "SOLD",
          teamId: "t1",
        }),
      ],
      Transaction: [
        buildTransaction({
          id: "tx1",
          playerId: "p1",
          teamId: "t1",
          amount: 350,
        }),
      ],
      AuctionActionHistory: [
        buildActionHistory({
          id: "h1",
          actionType: "SELL",
          fromPlayerId: "p1",
          toPlayerId: null,
          transactionId: "tx1",
        }),
      ],
    });

    const response = await removePlayerFromTeamDelete(
      new Request("http://localhost/api/admin/teams/t1/players", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: "p1" }),
      }) as unknown as Parameters<typeof removePlayerFromTeamDelete>[0],
      buildRouteContext("t1"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const player = mockContext.supabase.state.Player.find(
      (row) => row.id === "p1",
    );
    expect(player?.status).toBe("UNSOLD");
    expect(player?.teamId).toBeNull();

    const team = mockContext.supabase.state.Team.find((row) => row.id === "t1");
    expect(team?.pointsSpent).toBe(0);

    expect(mockContext.supabase.state.Transaction).toHaveLength(0);
    expect(mockContext.supabase.state.AuctionActionHistory).toHaveLength(0);
  });

  it("rejects remove when no reversible transaction exists", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Team: [buildTeam({ id: "t1", pointsSpent: 240 })],
      Player: [
        buildPlayer({
          id: "p1",
          status: "SOLD",
          teamId: "t1",
        }),
      ],
    });

    const response = await removePlayerFromTeamDelete(
      new Request("http://localhost/api/admin/teams/t1/players", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: "p1" }),
      }) as unknown as Parameters<typeof removePlayerFromTeamDelete>[0],
      buildRouteContext("t1"),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);

    const player = mockContext.supabase.state.Player.find(
      (row) => row.id === "p1",
    );
    expect(player?.status).toBe("SOLD");
    expect(player?.teamId).toBe("t1");
  });

  it("rejects add when bid constraints are violated", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Team: [
        buildTeam({
          id: "t1",
          pointsTotal: 1000,
          pointsSpent: 900,
        }),
      ],
      Player: [
        buildPlayer({
          id: "p1",
          status: "UNSOLD",
          teamId: null,
        }),
      ],
    });

    const response = await addPlayerToTeamPost(
      new Request("http://localhost/api/admin/teams/t1/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: "p1", amount: 10 }),
      }) as unknown as Parameters<typeof addPlayerToTeamPost>[0],
      buildRouteContext("t1"),
    );

    expect(response.status).toBe(409);

    const player = mockContext.supabase.state.Player.find(
      (row) => row.id === "p1",
    );
    expect(player?.status).toBe("UNSOLD");
    expect(player?.teamId).toBeNull();
    expect(mockContext.supabase.state.Transaction).toHaveLength(0);
    expect(mockContext.supabase.state.AuctionActionHistory).toHaveLength(0);
  });
});
