import { type NextRequest, NextResponse } from "next/server";
import { PLAYER_BASE_PRICE } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { sortPlayersByAuctionOrder } from "@/lib/playerFilters";
import { getSupabaseServerClient } from "@/lib/supabase";
import { withTransactionAmounts } from "@/lib/transactionAmounts";

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status");
    const supabase = await getSupabaseServerClient();

    let query = supabase.from("Player").select("*");

    if (status) {
      query = query.eq("status", status as "UNSOLD" | "SOLD" | "IN_AUCTION");
    }

    const { data: players, error } = await query.order("importOrder");
    if (error) throw error;

    const playerIds = (players ?? []).map((player) => player.id);
    let transactions: Array<{
      playerId: string;
      amount: number;
      createdAt: string;
    }> = [];

    if (playerIds.length > 0) {
      const { data: txData, error: txError } = await supabase
        .from("Transaction")
        .select("playerId,amount,createdAt")
        .in("playerId", playerIds);

      if (txError) throw txError;
      transactions = txData ?? [];
    }

    const normalizedPlayers = withTransactionAmounts(
      sortPlayersByAuctionOrder(players ?? []).map((player) => ({
        ...player,
        basePrice: PLAYER_BASE_PRICE,
      })),
      transactions,
    );

    return NextResponse.json({
      success: true,
      data: normalizedPlayers,
    });
  } catch (error) {
    logger.error("Failed to fetch players", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch players" },
      { status: 500 },
    );
  }
}
