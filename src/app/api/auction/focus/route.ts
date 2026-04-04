import { type NextRequest, NextResponse } from "next/server";
import { requireAuctionAccess } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const denied = await requireAuctionAccess();
  if (denied) return denied;

  try {
    const { playerId } = await req.json();
    if (!playerId || typeof playerId !== "string") {
      return NextResponse.json(
        { success: false, error: "Invalid player id" },
        { status: 400 },
      );
    }

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

    const { data: targetPlayer, error: playerError } = await supabase
      .from("Player")
      .select("*")
      .eq("id", playerId)
      .eq("sessionId", session.id)
      .maybeSingle();

    if (playerError) throw playerError;

    if (!targetPlayer) {
      return NextResponse.json(
        { success: false, error: "Player not found" },
        { status: 404 },
      );
    }

    if (targetPlayer.status === "SOLD") {
      const { error: clearLiveError } = await supabase
        .from("Player")
        .update({ status: "UNSOLD" })
        .eq("sessionId", session.id)
        .eq("status", "IN_AUCTION");

      if (clearLiveError) throw clearLiveError;

      return NextResponse.json({
        success: true,
        data: {
          player: targetPlayer,
          isLive: false,
          viewOnly: true,
        },
      });
    }

    const { error: clearOthersError } = await supabase
      .from("Player")
      .update({ status: "UNSOLD" })
      .eq("sessionId", session.id)
      .eq("status", "IN_AUCTION")
      .neq("id", targetPlayer.id);

    if (clearOthersError) throw clearOthersError;

    const { data: promotedPlayer, error: promoteError } = await supabase
      .from("Player")
      .update({ status: "IN_AUCTION" })
      .eq("sessionId", session.id)
      .eq("id", targetPlayer.id)
      .neq("status", "SOLD")
      .select("*")
      .maybeSingle();

    if (promoteError) throw promoteError;

    if (!promotedPlayer) {
      return NextResponse.json(
        {
          success: false,
          error: "Player could not be focused for auction",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        player: promotedPlayer,
        isLive: true,
        viewOnly: false,
      },
    });
  } catch (error) {
    logger.error("Failed to focus player", error);
    return NextResponse.json(
      { success: false, error: "Failed to focus player" },
      { status: 500 },
    );
  }
}
