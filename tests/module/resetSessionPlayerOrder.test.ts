import { describe, expect, it } from "vitest";
import {
  computeResetSessionPlayerOrder,
  parseFixedTailSequenceCsv,
  type FixedTailSequenceByRole,
  type ResetSessionPlayer,
} from "@/lib/resetSessionPlayerOrder";

function buildFixedTail(overrides?: Partial<FixedTailSequenceByRole>) {
  return {
    GK: [],
    DEFENCE: [],
    MIDFIELDER: [],
    ATTACKER: [],
    ...overrides,
  } satisfies FixedTailSequenceByRole;
}

function buildPlayer(
  overrides: Partial<ResetSessionPlayer>,
): ResetSessionPlayer {
  return {
    id: "player-1",
    name: "Player",
    position1: "FORWARD",
    importOrder: 0,
    ...overrides,
  };
}

describe("resetSessionPlayerOrder", () => {
  it("places matched fixed-tail attacker names at the end in CSV order", () => {
    const players: ResetSessionPlayer[] = [
      buildPlayer({ id: "f1", name: "Random One", importOrder: 0 }),
      buildPlayer({ id: "f2", name: "Random Two", importOrder: 1 }),
      buildPlayer({ id: "f3", name: "Random Three", importOrder: 2 }),
      buildPlayer({ id: "f4", name: "Rupam Palui", importOrder: 3 }),
      buildPlayer({ id: "f5", name: "Abhirup Dey", importOrder: 4 }),
    ];

    const result = computeResetSessionPlayerOrder(
      players,
      buildFixedTail({
        ATTACKER: ["Rupam Palui", "Sk Afaz Hossain", "Abhirup Dey"],
      }),
      {
        random: () => 0,
      },
    );

    const orderedAttackerNames = result.orderedPlayers.map(
      (player) => player.name,
    );

    expect(orderedAttackerNames.slice(-2)).toEqual([
      "Rupam Palui",
      "Abhirup Dey",
    ]);

    const attackerSummary = result.roleSummaries.find(
      (summary) => summary.role === "ATTACKER",
    );
    expect(attackerSummary).toMatchObject({
      totalPlayers: 5,
      shuffledCount: 3,
      fixedTailRequested: 3,
      fixedTailMatched: 2,
      fixedTailMissing: 1,
    });
  });

  it("consumes duplicate fixed names in CSV order and leaves extra players shuffled", () => {
    const players: ResetSessionPlayer[] = [
      buildPlayer({ id: "f1", name: "Rupam Palui", importOrder: 0 }),
      buildPlayer({ id: "f2", name: "Alpha", importOrder: 1 }),
      buildPlayer({ id: "f3", name: "Rupam Palui", importOrder: 2 }),
    ];

    const result = computeResetSessionPlayerOrder(
      players,
      buildFixedTail({
        ATTACKER: ["Rupam Palui", "Rupam Palui", "Rupam Palui"],
      }),
      {
        random: () => 0,
      },
    );

    const orderedIds = result.orderedPlayers.map((player) => player.id);

    expect(orderedIds).toEqual(["f2", "f1", "f3"]);

    const attackerSummary = result.roleSummaries.find(
      (summary) => summary.role === "ATTACKER",
    );
    expect(attackerSummary).toMatchObject({
      fixedTailRequested: 3,
      fixedTailMatched: 2,
      fixedTailMissing: 1,
    });
  });

  it("keeps global role blocks ordered and appends unknown-role players at the end", () => {
    const players: ResetSessionPlayer[] = [
      buildPlayer({
        id: "att",
        name: "Att",
        position1: "FORWARD",
        importOrder: 3,
      }),
      buildPlayer({ id: "gk", name: "Gk", position1: "GK", importOrder: 0 }),
      buildPlayer({ id: "mid", name: "Mid", position1: "MID", importOrder: 2 }),
      buildPlayer({
        id: "unk",
        name: "Unknown",
        position1: "WING",
        importOrder: 4,
      }),
      buildPlayer({ id: "def", name: "Def", position1: "DEF", importOrder: 1 }),
    ];

    const result = computeResetSessionPlayerOrder(players, buildFixedTail(), {
      random: () => 0,
    });

    expect(result.orderedPlayers.map((player) => player.id)).toEqual([
      "gk",
      "def",
      "mid",
      "att",
      "unk",
    ]);
    expect(result.unknownRolePlayers).toBe(1);
  });

  it("parses numbered CSV cells and sorts per role by sequence number", () => {
    const csv = [
      "GK,Defence,Midfield,Forward",
      "2. GK B,1. DEF A,,2. FWD B",
      "1. GK A,2. DEF B,1. MID A,1. FWD A",
    ].join("\n");

    const sequence = parseFixedTailSequenceCsv(csv);

    expect(sequence.GK).toEqual(["GK A", "GK B"]);
    expect(sequence.DEFENCE).toEqual(["DEF A", "DEF B"]);
    expect(sequence.MIDFIELDER).toEqual(["MID A"]);
    expect(sequence.ATTACKER).toEqual(["FWD A", "FWD B"]);
  });
});
