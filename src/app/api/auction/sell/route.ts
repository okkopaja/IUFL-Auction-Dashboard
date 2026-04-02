import { type NextRequest, NextResponse } from "next/server";
import { advanceToNextPlayer } from "@/lib/auctionProgression";
import { requireAuctionAccess } from "@/lib/auth";
import {
  calculateTeamBidConstraints,
  getBidValidationError,
} from "@/lib/bidConstraints";
import {
  AUCTION_MANDATORY_PLAYER_SLOTS,
  PLAYER_BASE_PRICE,
} from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  // ── Auth guard ──────────────────────────────────────────────────────────
  const denied = await requireAuctionAccess();
  if (denied) return denied;
  // ────────────────────────────────────────────────────────────────────────

  try {
    const { playerId, teamId, amount } = await req.json();
    const bidAmount = Number(amount);
    if (
      !playerId ||
      !teamId ||
      !Number.isFinite(bidAmount) ||
      bidAmount <= 0 ||
      !Number.isInteger(bidAmount)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid data" },
        { status: 400 },
      );
    }

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

    const { data: playerInfo, error: playerError } = await supabase
      .from("Player")
      .select("sessionId,status")
      .eq("id", playerId)
      .eq("sessionId", session.id)
      .maybeSingle();

    if (playerError) throw playerError;

    const { data: teamInfo, error: teamError } = await supabase
      .from("Team")
      .select("id,pointsTotal,pointsSpent")
      .eq("id", teamId)
      .eq("sessionId", session.id)
      .maybeSingle();

    if (teamError) throw teamError;

    if (!playerInfo)
      return NextResponse.json(
        { success: false, error: "Player not found" },
        { status: 404 },
      );

    if (!teamInfo) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 },
      );
    }

    if (playerInfo.status !== "IN_AUCTION") {
      return NextResponse.json(
        { success: false, error: "Player is not currently in auction" },
        { status: 409 },
      );
    }

    const pointsRemaining = teamInfo.pointsTotal - teamInfo.pointsSpent;
    const { count: playersOwnedCount, error: playersOwnedCountError } =
      await supabase
        .from("Player")
        .select("id", { count: "exact", head: true })
        .eq("sessionId", session.id)
        .eq("teamId", teamInfo.id);

    if (playersOwnedCountError) throw playersOwnedCountError;

    const constraints = calculateTeamBidConstraints({
      pointsRemaining,
      playersOwnedCount: playersOwnedCount ?? 0,
      mandatoryAuctionSlots: AUCTION_MANDATORY_PLAYER_SLOTS,
      basePrice: PLAYER_BASE_PRICE,
    });
    const bidValidationError = getBidValidationError(constraints, bidAmount);

    if (bidValidationError) {
      return NextResponse.json(
        { success: false, error: bidValidationError },
        { status: 409 },
      );
    }

    // Mark player as SOLD
    const { error: pErr } = await supabase
      .from("Player")
      .update({ status: "SOLD", teamId })
      .eq("sessionId", session.id)
      .eq("id", playerId);

    if (pErr) throw pErr;

    // Create transaction
    const { data: transaction, error: tErr } = await supabase
      .from("Transaction")
      .insert({
        id: crypto.randomUUID(),
        playerId,
        teamId,
        amount: bidAmount,
        sessionId: playerInfo.sessionId,
      })
      .select("*")
      .single();

    if (tErr) throw tErr;

    const { data: updatedTeam, error: teamUpdateError } = await supabase
      .from("Team")
      .update({ pointsSpent: teamInfo.pointsSpent + bidAmount })
      .eq("id", teamId)
      .eq("sessionId", session.id)
      .eq("pointsSpent", teamInfo.pointsSpent)
      .select("id")
      .maybeSingle();

    if (teamUpdateError) throw teamUpdateError;

    if (!updatedTeam) {
      return NextResponse.json(
        {
          success: false,
          error: "Team points changed during sale. Please retry.",
        },
        { status: 409 },
      );
    }

    const nextPlayer = await advanceToNextPlayer(supabase, session.id);

    const { error: historyError } = await supabase
      .from("AuctionActionHistory")
      .insert({
        id: crypto.randomUUID(),
        sessionId: session.id,
        fromPlayerId: playerId,
        toPlayerId: nextPlayer?.id ?? null,
        actionType: "SELL",
        transactionId: transaction.id,
      });

    if (historyError) throw historyError;

    return NextResponse.json({
      success: true,
      data: { transaction, nextPlayer },
    });
  } catch (error) {
    logger.error("Failed to sell player", error);
    return NextResponse.json(
      { success: false, error: "Failed to sell player" },
      { status: 500 },
    );
  }
}
