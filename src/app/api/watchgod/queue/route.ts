import { type NextRequest, NextResponse } from "next/server";
import { getUpcomingQueuePlayers } from "@/lib/auctionQueue";
import { requireSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  sortPlayersByAuctionOrder,
  sortPlayersByAuctionQueueOrder,
} from "@/lib/playerFilters";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type QueueDirection = "UP" | "DOWN";

type PlayerRow = {
  id: string;
  name: string;
  position1: string;
  importOrder: number;
  auctionOrder: number | null;
  status: "UNSOLD" | "IN_AUCTION" | "SOLD";
};

function invalidMove(error: string) {
  return NextResponse.json({ success: false, error }, { status: 409 });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const playerId = body?.playerId;
    const direction = body?.direction as QueueDirection | undefined;

    if (
      typeof playerId !== "string" ||
      (direction !== "UP" && direction !== "DOWN")
    ) {
      return NextResponse.json(
        { success: false, error: "playerId and direction are required" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data: session, error: sessionError } = await supabase
      .from("AuctionSession")
      .select("id,isAuctionEnded")
      .eq("isActive", true)
      .limit(1)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No active auction session found" },
        { status: 404 },
      );
    }
    if (session.isAuctionEnded) {
      return invalidMove("The auction session has ended");
    }

    const { data: playersData, error: playersError } = await supabase
      .from("Player")
      .select("id,name,position1,importOrder,auctionOrder,status")
      .eq("sessionId", session.id);

    if (playersError) throw playersError;

    const { data: historyData, error: historyError } = await supabase
      .from("AuctionActionHistory")
      .select("fromPlayerId")
      .eq("sessionId", session.id);

    if (historyError) throw historyError;

    const players = (playersData ?? []) as PlayerRow[];
    const currentPlayers = players.filter(
      (player) => player.status === "IN_AUCTION",
    );
    if (currentPlayers.length !== 1) {
      return invalidMove(
        "A live in-auction player is required to reorder the queue",
      );
    }

    // A session starts with its established positional/import order. The first
    // manual move materializes that order so every later swap is durable.
    const hasPersistedQueueOrder = players.every((player) =>
      Number.isInteger(player.auctionOrder),
    );
    const orderedPlayers = hasPersistedQueueOrder
      ? sortPlayersByAuctionQueueOrder(players)
      : sortPlayersByAuctionOrder(players);
    const upcoming = getUpcomingQueuePlayers(
      orderedPlayers,
      currentPlayers[0].id,
    );
    const playerIndex = upcoming.findIndex((player) => player.id === playerId);
    const passedPlayerIds = new Set(
      (historyData ?? []).map((history) => history.fromPlayerId),
    );

    if (playerIndex === -1) {
      return invalidMove("Only an upcoming player can be moved");
    }

    const adjacentIndex =
      direction === "UP" ? playerIndex - 1 : playerIndex + 1;
    if (adjacentIndex < 0 || adjacentIndex >= upcoming.length) {
      return invalidMove(
        "That player is already at the edge of the upcoming queue",
      );
    }

    const movingPlayer = upcoming[playerIndex];
    const adjacentPlayer = upcoming[adjacentIndex];
    if (passedPlayerIds.has(movingPlayer.id)) {
      return invalidMove("Passed players cannot be moved");
    }
    if (passedPlayerIds.has(adjacentPlayer.id)) {
      return invalidMove("Passed players cannot be moved across");
    }
    const orderByPlayerId = new Map(
      orderedPlayers.map((player, index) => [player.id, index]),
    );
    const movingOrder = orderByPlayerId.get(movingPlayer.id);
    const adjacentOrder = orderByPlayerId.get(adjacentPlayer.id);

    if (movingOrder === undefined || adjacentOrder === undefined) {
      throw new Error("Unable to resolve queue positions");
    }

    const initializationUpdates = hasPersistedQueueOrder
      ? []
      : orderedPlayers
          .filter(
            (player) =>
              player.id !== movingPlayer.id && player.id !== adjacentPlayer.id,
          )
          .map((player, index) => ({
            id: player.id,
            auctionOrder: orderByPlayerId.get(player.id) ?? index,
          }));

    for (const update of initializationUpdates) {
      const { error } = await supabase
        .from("Player")
        .update({ auctionOrder: update.auctionOrder })
        .eq("id", update.id)
        .eq("sessionId", session.id);
      if (error) throw error;
    }

    const [movingUpdate, adjacentUpdate] = await Promise.all([
      supabase
        .from("Player")
        .update({ auctionOrder: adjacentOrder })
        .eq("id", movingPlayer.id)
        .eq("sessionId", session.id),
      supabase
        .from("Player")
        .update({ auctionOrder: movingOrder })
        .eq("id", adjacentPlayer.id)
        .eq("sessionId", session.id),
    ]);

    if (movingUpdate.error) throw movingUpdate.error;
    if (adjacentUpdate.error) throw adjacentUpdate.error;

    return NextResponse.json({
      success: true,
      data: {
        movedPlayerId: movingPlayer.id,
        direction,
      },
    });
  } catch (error) {
    logger.error("Failed to reorder Watchgod auction queue", error);
    return NextResponse.json(
      { success: false, error: "Failed to reorder auction queue" },
      { status: 500 },
    );
  }
}
