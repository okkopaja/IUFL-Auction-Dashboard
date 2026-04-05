import { describe, expect, it } from "vitest";
import {
  buildTeamWiseExport,
  type TeamWiseExportPlayer,
  type TeamWiseExportTeam,
} from "@/features/player-export/teamWiseExport";

function buildTeam(overrides: Partial<TeamWiseExportTeam>): TeamWiseExportTeam {
  return {
    id: "team-default",
    name: "Default Team",
    ...overrides,
  };
}

function buildPlayer(
  overrides: Partial<TeamWiseExportPlayer>,
): TeamWiseExportPlayer {
  return {
    id: "player-default",
    name: "Player",
    status: "UNSOLD",
    teamId: null,
    position1: "GK",
    importOrder: 0,
    ...overrides,
  };
}

describe("buildTeamWiseExport", () => {
  it("builds A-Z team columns and appends Unsold + Absentee with row-wise alignment", () => {
    const teams = [
      buildTeam({ id: "t-z", name: "Zulu" }),
      buildTeam({ id: "t-a", name: "Alpha" }),
    ];

    const players = [
      buildPlayer({
        id: "p-z",
        name: "Zulu Keeper",
        status: "SOLD",
        teamId: "t-z",
        position1: "GK",
        importOrder: 2,
      }),
      buildPlayer({
        id: "p-a",
        name: "Alpha Mid",
        status: "SOLD",
        teamId: "t-a",
        position1: "MIDFIELDER",
        importOrder: 4,
      }),
      buildPlayer({
        id: "p-u",
        name: "Unsold Defender",
        status: "UNSOLD",
        position1: "DEFENCE",
        importOrder: 3,
      }),
      buildPlayer({
        id: "p-live",
        name: "Auction Forward",
        status: "IN_AUCTION",
        position1: "ATTACKER",
        importOrder: 1,
      }),
      buildPlayer({
        id: "p-abs",
        name: "Abhradip Mondal",
        status: "UNSOLD",
        position1: "GK",
        importOrder: 0,
      }),
    ];

    const result = buildTeamWiseExport({
      teams,
      players,
      absenteeNames: ["Abhradip Mondal", "Ghost Player"],
      generatedAt: new Date("2026-04-05T10:30:45.000Z"),
    });

    expect(result.headers).toEqual(["Alpha", "Zulu", "Unsold", "Absentee"]);
    expect(result.rowCount).toBe(2);

    expect(result.rows).toEqual([
      ["Alpha Mid", "Zulu Keeper", "Unsold Defender", "Abhradip Mondal"],
      ["", "", "Auction Forward", "Ghost Player"],
    ]);

    expect(result.suggestedFileName).toMatch(
      /^team-wise-players-\d{8}-\d{6}\.csv$/,
    );
  });

  it("applies absentee-only overlap and excludes matching UNSOLD players from Unsold", () => {
    const result = buildTeamWiseExport({
      teams: [buildTeam({ id: "t1", name: "Alpha" })],
      players: [
        buildPlayer({
          id: "p1",
          name: "  Kaustuv   paul ",
          status: "UNSOLD",
          position1: "MIDFIELDER",
          importOrder: 8,
        }),
      ],
      absenteeNames: ["kaustuv paul"],
    });

    const unsoldIndex = result.headers.indexOf("Unsold");
    const absenteeIndex = result.headers.indexOf("Absentee");

    const unsoldValues = result.rows
      .map((row) => row[unsoldIndex])
      .filter(Boolean);
    const absenteeValues = result.rows
      .map((row) => row[absenteeIndex])
      .filter(Boolean);

    expect(unsoldValues).toEqual([]);
    expect(absenteeValues).toEqual(["kaustuv paul"]);
  });

  it("falls back SOLD players without a known team into Unsold", () => {
    const result = buildTeamWiseExport({
      teams: [buildTeam({ id: "t1", name: "Only Team" })],
      players: [
        buildPlayer({
          id: "p1",
          name: "Floating Sold",
          status: "SOLD",
          teamId: null,
          position1: "GK",
          importOrder: 1,
        }),
      ],
      absenteeNames: [],
    });

    const teamIndex = result.headers.indexOf("Only Team");
    const unsoldIndex = result.headers.indexOf("Unsold");

    const teamValues = result.rows.map((row) => row[teamIndex]).filter(Boolean);
    const unsoldValues = result.rows
      .map((row) => row[unsoldIndex])
      .filter(Boolean);

    expect(teamValues).toEqual([]);
    expect(unsoldValues).toEqual(["Floating Sold"]);
  });

  it("pads shorter columns with blanks when column lengths are uneven", () => {
    const result = buildTeamWiseExport({
      teams: [
        buildTeam({ id: "t1", name: "Alpha" }),
        buildTeam({ id: "t2", name: "Beta" }),
      ],
      players: [
        buildPlayer({
          id: "p1",
          name: "Alpha One",
          status: "SOLD",
          teamId: "t1",
          position1: "GK",
          importOrder: 1,
        }),
        buildPlayer({
          id: "p2",
          name: "Alpha Two",
          status: "SOLD",
          teamId: "t1",
          position1: "DEFENCE",
          importOrder: 2,
        }),
        buildPlayer({
          id: "p3",
          name: "Beta One",
          status: "SOLD",
          teamId: "t2",
          position1: "MIDFIELDER",
          importOrder: 3,
        }),
      ],
      absenteeNames: [],
    });

    expect(result.rowCount).toBe(2);
    expect(result.rows[1]).toEqual(["Alpha Two", "", "", ""]);
  });
});
