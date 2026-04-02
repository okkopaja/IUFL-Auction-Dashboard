import { NextResponse } from "next/server";
import { requireAuctionAccess } from "@/lib/auth";
import { PLAYER_BASE_PRICE } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { withTransactionAmounts } from "@/lib/transactionAmounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuctionAccess();
  if (denied) return denied;

  try {
    const supabase = getSupabaseAdminClient();

    const { data: session, error: sessionError } = await supabase
      .from("AuctionSession")
      .select("id")
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

    const { data: current, error } = await supabase
      .from("Player")
      .select("*")
      .eq("sessionId", session.id)
      .eq("status", "IN_AUCTION")
      .order("updatedAt", { ascending: false })
      .order("importOrder", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const { count: unsoldCount, error: unsoldError } = await supabase
      .from("Player")
      .select("id", { count: "exact", head: true })
      .eq("sessionId", session.id)
      .eq("status", "UNSOLD");

    if (unsoldError) throw unsoldError;

    const { data: txData, error: txError } = await supabase
      .from("Transaction")
      .select("playerId,amount,createdAt")
      .eq("sessionId", session.id)
      .eq("playerId", current?.id ?? "");

    if (txError) throw txError;

    const [enrichedCurrent] = current
      ? withTransactionAmounts(
          [
            {
              ...current,
              basePrice: PLAYER_BASE_PRICE,
            },
          ],
          txData ?? [],
        )
      : [null];

    return NextResponse.json({
      success: true,
      data: enrichedCurrent,
      meta: {
        isComplete: !enrichedCurrent && (unsoldCount ?? 0) === 0,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch current player", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch current player" },
      { status: 500 },
    );
  }
}
