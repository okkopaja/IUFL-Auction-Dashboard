import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as teamWiseExportGet } from "@/app/api/admin/players/team-wise-export/route";
import {
  buildActiveSession,
  buildPlayer,
  buildTeam,
  createInMemorySupabase,
} from "../utils/inMemorySupabase";

type InMemoryClient = ReturnType<typeof createInMemorySupabase>;

const mockContext = vi.hoisted(() => ({
  supabase: null as InMemoryClient | null,
}));

const authMocks = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(async () => null),
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

describe("admin team-wise export route", () => {
  beforeEach(() => {
    mockContext.supabase = null;
    authMocks.requireSuperAdmin.mockClear();
  });

  it("returns export data with team columns plus Unsold and Absentee", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Team: [
        buildTeam({ id: "t-b", name: "Beta Team", shortCode: "BET" }),
        buildTeam({ id: "t-a", name: "Alpha Team", shortCode: "ALP" }),
      ],
      Player: [
        buildPlayer({
          id: "sold-1",
          name: "Sold Player",
          status: "SOLD",
          teamId: "t-b",
          position1: "GK",
          importOrder: 5,
        }),
        buildPlayer({
          id: "live-1",
          name: "Live Player",
          status: "IN_AUCTION",
          teamId: null,
          position1: "DEFENCE",
          importOrder: 2,
        }),
        buildPlayer({
          id: "abs-1",
          name: "Abhradip Mondal",
          status: "UNSOLD",
          teamId: null,
          position1: "MIDFIELDER",
          importOrder: 1,
        }),
      ],
    });

    const response = await teamWiseExportGet();

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.headers).toEqual([
      "Alpha Team",
      "Beta Team",
      "Unsold",
      "Absentee",
    ]);

    const unsoldIndex = body.data.headers.indexOf("Unsold");
    const absenteeIndex = body.data.headers.indexOf("Absentee");

    const unsoldNames = body.data.rows
      .map((row: string[]) => row[unsoldIndex])
      .filter(Boolean);
    const absenteeNames = body.data.rows
      .map((row: string[]) => row[absenteeIndex])
      .filter(Boolean);

    expect(unsoldNames).toContain("Live Player");
    expect(unsoldNames).not.toContain("Abhradip Mondal");
    expect(absenteeNames).toContain("Abhradip Mondal");
  });

  it("returns 404 when there is no active auction session", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [],
      Team: [],
      Player: [],
    });

    const response = await teamWiseExportGet();

    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("No active auction session found");
  });

  it("places SOLD players without known team assignment into Unsold", async () => {
    mockContext.supabase = createInMemorySupabase({
      AuctionSession: [buildActiveSession()],
      Team: [buildTeam({ id: "t-1", name: "Alpha Team" })],
      Player: [
        buildPlayer({
          id: "sold-floating",
          name: "Floating Sold",
          status: "SOLD",
          teamId: null,
          position1: "GK",
          importOrder: 1,
        }),
      ],
    });

    const response = await teamWiseExportGet();

    expect(response.status).toBe(200);

    const body = await response.json();
    const unsoldIndex = body.data.headers.indexOf("Unsold");
    const unsoldNames = body.data.rows
      .map((row: string[]) => row[unsoldIndex])
      .filter(Boolean);

    expect(unsoldNames).toContain("Floating Sold");
  });
});
