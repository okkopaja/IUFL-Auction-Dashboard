import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
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

const addPlayerPayloadSchema = z.object({
  playerId: z.string().trim().min(1, "Player id is required"),
  amount: z.coerce
    .number()
    .int("Amount must be a whole number")
    .positive("Amount must be greater than zero"),
});

const removePlayerPayloadSchema = z.object({
  playerId: z.string().trim().min(1, "Player id is required"),
});

async function getActiveSessionId() {
  const supabase = getSupabaseAdminClient();

  const { data: session, error: sessionError } = await supabase
    .from("AuctionSession")
    .select("id")
    .eq("isActive", true)
    .limit(1)
    .maybeSingle();

  if (sessionError) throw sessionError;

  return {
    supabase,
    sessionId: session?.id ?? null,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: teamId } = await params;
    const body = await req.json();
    const parseResult = addPlayerPayloadSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { playerId, amount } = parseResult.data;
    const { supabase, sessionId } = await getActiveSessionId();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "No active auction session found" },
        { status: 404 },
      );
    }

    const { data: team, error: teamError } = await supabase
      .from("Team")
      .select("id,sessionId,pointsTotal,pointsSpent")
      .eq("id", teamId)
      .eq("sessionId", sessionId)
      .maybeSingle();

    if (teamError) throw teamError;

    if (!team) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 },
      );
    }

    const { data: player, error: playerError } = await supabase
      .from("Player")
      .select("id,name,status,teamId,sessionId")
      .eq("id", playerId)
      .eq("sessionId", sessionId)
      .maybeSingle();

    if (playerError) throw playerError;

    if (!player) {
      return NextResponse.json(
        { success: false, error: "Player not found" },
        { status: 404 },
      );
    }

    if (player.status !== "UNSOLD" || player.teamId) {
      return NextResponse.json(
        {
          success: false,
          error: "Only UNSOLD players without a team can be added",
        },
        { status: 409 },
      );
    }

    const { count: playersOwnedCount, error: playersOwnedCountError } =
      await supabase
        .from("Player")
        .select("id", { count: "exact", head: true })
        .eq("sessionId", sessionId)
        .eq("teamId", team.id);

    if (playersOwnedCountError) throw playersOwnedCountError;

    const pointsRemaining = team.pointsTotal - team.pointsSpent;
    const constraints = calculateTeamBidConstraints({
      pointsRemaining,
      playersOwnedCount: playersOwnedCount ?? 0,
      mandatoryAuctionSlots: AUCTION_MANDATORY_PLAYER_SLOTS,
      basePrice: PLAYER_BASE_PRICE,
    });

    const bidValidationError = getBidValidationError(constraints, amount);
    if (bidValidationError) {
      return NextResponse.json(
        { success: false, error: bidValidationError },
        { status: 409 },
      );
    }

    const { data: updatedPlayer, error: playerUpdateError } = await supabase
      .from("Player")
      .update({
        status: "SOLD",
        teamId: team.id,
      })
      .eq("id", player.id)
      .eq("sessionId", sessionId)
      .eq("status", "UNSOLD")
      .select("id,name,status,teamId")
      .maybeSingle();

    if (playerUpdateError) throw playerUpdateError;

    if (!updatedPlayer) {
      return NextResponse.json(
        {
          success: false,
          error: "Player state changed before add operation. Please retry.",
        },
        { status: 409 },
      );
    }

    const nextPointsSpent = team.pointsSpent + amount;
    const { data: updatedTeam, error: teamUpdateError } = await supabase
      .from("Team")
      .update({ pointsSpent: nextPointsSpent })
      .eq("id", team.id)
      .eq("sessionId", sessionId)
      .eq("pointsSpent", team.pointsSpent)
      .select("id,pointsTotal,pointsSpent")
      .maybeSingle();

    if (teamUpdateError) throw teamUpdateError;

    if (!updatedTeam) {
      return NextResponse.json(
        {
          success: false,
          error: "Team points changed during add operation. Please retry.",
        },
        { status: 409 },
      );
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("Transaction")
      .insert({
        id: crypto.randomUUID(),
        playerId: updatedPlayer.id,
        teamId: team.id,
        amount,
        sessionId,
      })
      .select("id,playerId,teamId,amount,sessionId,createdAt")
      .single();

    if (transactionError) throw transactionError;

    const { error: historyError } = await supabase
      .from("AuctionActionHistory")
      .insert({
        id: crypto.randomUUID(),
        sessionId,
        fromPlayerId: updatedPlayer.id,
        toPlayerId: null,
        actionType: "SELL",
        transactionId: transaction.id,
      });

    if (historyError) throw historyError;

    return NextResponse.json({
      success: true,
      data: {
        playerId: updatedPlayer.id,
        playerName: updatedPlayer.name,
        teamId: updatedTeam.id,
        amount: transaction.amount,
        transactionId: transaction.id,
        pointsSpent: updatedTeam.pointsSpent,
        pointsRemaining: updatedTeam.pointsTotal - updatedTeam.pointsSpent,
      },
    });
  } catch (error) {
    logger.error("Failed to add player to team", error);
    return NextResponse.json(
      { success: false, error: "Failed to add player to team" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: teamId } = await params;
    const body = await req.json();
    const parseResult = removePlayerPayloadSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { playerId } = parseResult.data;
    const { supabase, sessionId } = await getActiveSessionId();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "No active auction session found" },
        { status: 404 },
      );
    }

    const { data: team, error: teamError } = await supabase
      .from("Team")
      .select("id,sessionId,pointsTotal,pointsSpent")
      .eq("id", teamId)
      .eq("sessionId", sessionId)
      .maybeSingle();

    if (teamError) throw teamError;

    if (!team) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 },
      );
    }

    const { data: player, error: playerError } = await supabase
      .from("Player")
      .select("id,name,status,teamId")
      .eq("id", playerId)
      .eq("sessionId", sessionId)
      .maybeSingle();

    if (playerError) throw playerError;

    if (!player) {
      return NextResponse.json(
        { success: false, error: "Player not found" },
        { status: 404 },
      );
    }

    if (player.status !== "SOLD" || player.teamId !== team.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Only SOLD players from this team can be removed to UNSOLD",
        },
        { status: 409 },
      );
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("Transaction")
      .select("id,playerId,teamId,amount,sessionId,createdAt")
      .eq("sessionId", sessionId)
      .eq("teamId", team.id)
      .eq("playerId", player.id)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (transactionError) throw transactionError;

    if (!transaction) {
      return NextResponse.json(
        {
          success: false,
          error: "No reversible transaction found for this player/team",
        },
        { status: 409 },
      );
    }

    if (team.pointsSpent < transaction.amount) {
      return NextResponse.json(
        {
          success: false,
          error: "Team points are lower than the player's transaction amount",
        },
        { status: 409 },
      );
    }

    const { data: updatedPlayer, error: playerUpdateError } = await supabase
      .from("Player")
      .update({
        status: "UNSOLD",
        teamId: null,
      })
      .eq("id", player.id)
      .eq("sessionId", sessionId)
      .eq("status", "SOLD")
      .eq("teamId", team.id)
      .select("id,name,status,teamId")
      .maybeSingle();

    if (playerUpdateError) throw playerUpdateError;

    if (!updatedPlayer) {
      return NextResponse.json(
        {
          success: false,
          error: "Player state changed before remove operation. Please retry.",
        },
        { status: 409 },
      );
    }

    const nextPointsSpent = team.pointsSpent - transaction.amount;
    const { data: updatedTeam, error: teamUpdateError } = await supabase
      .from("Team")
      .update({ pointsSpent: nextPointsSpent })
      .eq("id", team.id)
      .eq("sessionId", sessionId)
      .eq("pointsSpent", team.pointsSpent)
      .select("id,pointsTotal,pointsSpent")
      .maybeSingle();

    if (teamUpdateError) throw teamUpdateError;

    if (!updatedTeam) {
      return NextResponse.json(
        {
          success: false,
          error: "Team points changed during remove operation. Please retry.",
        },
        { status: 409 },
      );
    }

    const { error: historyDeleteError } = await supabase
      .from("AuctionActionHistory")
      .delete()
      .eq("sessionId", sessionId)
      .eq("transactionId", transaction.id);

    if (historyDeleteError) throw historyDeleteError;

    const { error: transactionDeleteError } = await supabase
      .from("Transaction")
      .delete()
      .eq("id", transaction.id)
      .eq("sessionId", sessionId);

    if (transactionDeleteError) throw transactionDeleteError;

    return NextResponse.json({
      success: true,
      data: {
        playerId: updatedPlayer.id,
        playerName: updatedPlayer.name,
        teamId: updatedTeam.id,
        amount: transaction.amount,
        transactionId: transaction.id,
        pointsSpent: updatedTeam.pointsSpent,
        pointsRemaining: updatedTeam.pointsTotal - updatedTeam.pointsSpent,
      },
    });
  } catch (error) {
    logger.error("Failed to remove player from team", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove player from team" },
      { status: 500 },
    );
  }
}
