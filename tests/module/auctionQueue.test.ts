import { describe, expect, it } from "vitest";
import { getUpcomingQueuePlayers } from "@/lib/auctionQueue";

describe("auction queue", () => {
  it("returns only the circular upcoming unsold queue after the live player", () => {
    const players = [
      { id: "p1", status: "UNSOLD" as const },
      { id: "p2", status: "IN_AUCTION" as const },
      { id: "p3", status: "SOLD" as const },
      { id: "p4", status: "UNSOLD" as const },
    ];

    expect(
      getUpcomingQueuePlayers(players, "p2").map((player) => player.id),
    ).toEqual(["p4", "p1"]);
  });
});
