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

    const { data: latestTx, error: txError } = await supabase
      .from("Transaction")
      .select("id,playerId,teamId,amount,sessionId")
      .eq("sessionId", session.id)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (txError) throw txError;
    if (!latestTx) {
      return NextResponse.json(
        { success: false, error: "No transaction available to undo" },
        { status: 409 },
      );
    }

    const [playerRes, teamRes] = await Promise.all([
      supabase
        .from("Player")
        .select("id,status,teamId")
        .eq("id", latestTx.playerId)
        .eq("sessionId", session.id)
        .maybeSingle(),
      supabase
        .from("Team")
        .select("id,pointsSpent")
        .eq("id", latestTx.teamId)
        .eq("sessionId", session.id)
        .maybeSingle(),
    ]);

    if (playerRes.error) throw playerRes.error;
    if (teamRes.error) throw teamRes.error;

    if (!playerRes.data || !teamRes.data) {
      return NextResponse.json(
        { success: false, error: "Undo target no longer exists" },
        { status: 409 },
      );
    }

    if (
      playerRes.data.status !== "SOLD" ||
      playerRes.data.teamId !== latestTx.teamId
    ) {
      return NextResponse.json(
        { success: false, error: "Latest transaction cannot be safely undone" },
        { status: 409 },
      );
    }

    if (teamRes.data.pointsSpent < latestTx.amount) {
      return NextResponse.json(
        {
          success: false,
          error: "Team points are lower than latest transaction amount",
        },
        { status: 409 },
      );
    }

    const { error: playerUpdateError } = await supabase
      .from("Player")
      .update({ status: "UNSOLD", teamId: null })
      .eq("id", latestTx.playerId)
      .eq("sessionId", session.id)
      .eq("status", "SOLD")
      .eq("teamId", latestTx.teamId);

    if (playerUpdateError) throw playerUpdateError;

    const nextPointsSpent = teamRes.data.pointsSpent - latestTx.amount;
    const { data: updatedTeam, error: teamUpdateError } = await supabase
      .from("Team")
      .update({ pointsSpent: nextPointsSpent })
      .eq("id", latestTx.teamId)
      .eq("sessionId", session.id)
      .eq("pointsSpent", teamRes.data.pointsSpent)
      .select("id")
      .maybeSingle();

    if (teamUpdateError) throw teamUpdateError;

    if (!updatedTeam) {
      return NextResponse.json(
        {
          success: false,
          error: "Team points changed during undo. Please retry.",
        },
        { status: 409 },
      );
    }

    const { error: historyDeleteError } = await supabase
      .from("AuctionActionHistory")
      .delete()
      .eq("transactionId", latestTx.id)
      .eq("sessionId", session.id);

    if (historyDeleteError) throw historyDeleteError;

    const { error: transactionDeleteError } = await supabase
      .from("Transaction")
      .delete()
      .eq("id", latestTx.id)
      .eq("sessionId", session.id);

    if (transactionDeleteError) throw transactionDeleteError;

    return NextResponse.json({
      success: true,
      data: {
        transactionId: latestTx.id,
        playerId: latestTx.playerId,
        teamId: latestTx.teamId,
        amount: latestTx.amount,
      },
    });
  } catch (error) {
    logger.error("Failed to undo latest transaction", error);
    return NextResponse.json(
      { success: false, error: "Failed to undo latest transaction" },
      { status: 500 },
    );
  }
}
