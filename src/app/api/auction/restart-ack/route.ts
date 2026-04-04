import { NextResponse } from "next/server";
import { requireAuctionAccess } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST() {
  const denied = await requireAuctionAccess();
  if (denied) return denied;

  try {
    const supabase = getSupabaseAdminClient();

    const { data: session, error: sessionError } = await supabase
      .from("AuctionSession")
      .select("id,restartAckRequired,isAuctionEnded,unsoldIterationRound")
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
      return NextResponse.json({
        success: true,
        data: {
          acknowledged: false,
          reason: "AUCTION_ENDED",
          round: session.unsoldIterationRound ?? 1,
        },
      });
    }

    if (!session.restartAckRequired) {
      return NextResponse.json({
        success: true,
        data: {
          acknowledged: false,
          reason: "ALREADY_ACKNOWLEDGED",
          round: session.unsoldIterationRound ?? 1,
        },
      });
    }

    const { error: updateError } = await supabase
      .from("AuctionSession")
      .update({ restartAckRequired: false })
      .eq("id", session.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      data: {
        acknowledged: true,
        round: session.unsoldIterationRound ?? 1,
      },
    });
  } catch (error) {
    logger.error("Failed to acknowledge auction restart", error);
    return NextResponse.json(
      { success: false, error: "Failed to acknowledge auction restart" },
      { status: 500 },
    );
  }
}
