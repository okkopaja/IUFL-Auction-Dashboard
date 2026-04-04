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
      .select("id,restartAckRequired,isAuctionEnded,auctionEndReason")
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

    if (session.restartAckRequired) {
      return NextResponse.json(
        {
          success: false,
          error: "Restart acknowledgment required before continuing auction",
          code: "RESTART_ACK_REQUIRED",
        },
        { status: 409 },
      );
    }

    if (session.isAuctionEnded) {
      return NextResponse.json(
        {
          success: false,
          error: "Auction session has already ended",
          code: session.auctionEndReason ?? "AUCTION_ENDED",
        },
        { status: 409 },
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

    let referencePlayerId = currentInAuction?.id ?? null;

    if (!referencePlayerId) {
      const { data: latestAction, error: latestActionError } = await supabase
        .from("AuctionActionHistory")
        .select("fromPlayerId")
        .eq("sessionId", session.id)
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestActionError) throw latestActionError;

      referencePlayerId = latestAction?.fromPlayerId ?? null;
    }

    const progression = await advanceToNextPlayer(supabase, session.id, {
      referencePlayerId,
    });

    if (currentInAuction) {
      const { error: historyError } = await supabase
        .from("AuctionActionHistory")
        .insert({
          id: crypto.randomUUID(),
          sessionId: session.id,
          fromPlayerId: currentInAuction.id,
          toPlayerId: progression.nextPlayer?.id ?? null,
          actionType: "PASS",
          transactionId: null,
        });

      if (historyError) throw historyError;
    }

    return NextResponse.json({
      success: true,
      data: {
        nextPlayer: progression.nextPlayer,
        progression,
      },
    });
  } catch (error) {
    logger.error("Failed to advance next player", error);
    return NextResponse.json(
      { success: false, error: "Failed to advance next player" },
      { status: 500 },
    );
  }
}
