import { NextResponse } from "next/server";
import { advanceToNextPlayer } from "@/lib/auctionProgression";
import { requireAuctionAccess } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST() {
  // ── Auth guard ──────────────────────────────────────────────────────────
  const denied = await requireAuctionAccess();
  if (denied) return denied;
  // ────────────────────────────────────────────────────────────────────────

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

    const { data: currentInAuction, error: currentPlayerError } = await supabase
      .from("Player")
      .select("id,updatedAt,importOrder")
      .eq("sessionId", session.id)
      .eq("status", "IN_AUCTION")
      .order("updatedAt", { ascending: false })
      .order("importOrder", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (currentPlayerError) throw currentPlayerError;

    const nextUnsold = await advanceToNextPlayer(supabase, session.id);

    if (currentInAuction) {
      const { error: historyError } = await supabase
        .from("AuctionActionHistory")
        .insert({
          id: crypto.randomUUID(),
          sessionId: session.id,
          fromPlayerId: currentInAuction.id,
          toPlayerId: nextUnsold?.id ?? null,
          actionType: "PASS",
          transactionId: null,
        });

      if (historyError) throw historyError;
    }

    return NextResponse.json({
      success: true,
      data: { nextPlayer: nextUnsold },
    });
  } catch (error) {
    logger.error("Failed to advance next player", error);
    return NextResponse.json(
      { success: false, error: "Failed to advance next player" },
      { status: 500 },
    );
  }
}
