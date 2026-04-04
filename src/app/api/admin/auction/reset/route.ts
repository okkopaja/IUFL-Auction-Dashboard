import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUserPassword, requireSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { buildResetSessionPlayerOrder } from "@/lib/resetSessionPlayerOrder";
import { getSupabaseAdminClient } from "@/lib/supabase";

const resetAuctionPayloadSchema = z.object({
  password: z
    .string()
    .min(1, "Password is required")
    .max(200, "Password is too long"),
});

type ResetRoutePlayer = {
  id: string;
  name: string;
  position1: string;
  importOrder: number;
};

const PLAYER_RESET_UPDATE_BATCH_SIZE = 100;

export async function POST(req: NextRequest) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const parseResult = resetAuctionPayloadSchema.safeParse(body);

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

    const passwordDenied = await requireCurrentUserPassword(
      parseResult.data.password,
    );
    if (passwordDenied) return passwordDenied;

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

    const sessionId = session.id;

    const [txCountResult, teamCountResult, playerCountResult] =
      await Promise.all([
        supabase
          .from("Transaction")
          .select("id", { count: "exact", head: true })
          .eq("sessionId", sessionId),
        supabase
          .from("Team")
          .select("id", { count: "exact", head: true })
          .eq("sessionId", sessionId),
        supabase
          .from("Player")
          .select("id", { count: "exact", head: true })
          .eq("sessionId", sessionId),
      ]);

    if (txCountResult.error) throw txCountResult.error;
    if (teamCountResult.error) throw teamCountResult.error;
    if (playerCountResult.error) throw playerCountResult.error;

    const { data: sessionPlayers, error: sessionPlayersError } = await supabase
      .from("Player")
      .select("id,name,position1,importOrder")
      .eq("sessionId", sessionId)
      .order("importOrder", { ascending: true });

    if (sessionPlayersError) throw sessionPlayersError;

    const resetPlayerOrder = await buildResetSessionPlayerOrder(
      (sessionPlayers ?? []) as ResetRoutePlayer[],
    );

    const { error: deleteHistoryError } = await supabase
      .from("AuctionActionHistory")
      .delete()
      .eq("sessionId", sessionId);
    if (deleteHistoryError) throw deleteHistoryError;

    const { error: deleteTxError } = await supabase
      .from("Transaction")
      .delete()
      .eq("sessionId", sessionId);
    if (deleteTxError) throw deleteTxError;

    const { error: resetTeamsError } = await supabase
      .from("Team")
      .update({ pointsSpent: 0 })
      .eq("sessionId", sessionId);
    if (resetTeamsError) throw resetTeamsError;

    for (
      let startIndex = 0;
      startIndex < resetPlayerOrder.orderedPlayers.length;
      startIndex += PLAYER_RESET_UPDATE_BATCH_SIZE
    ) {
      const batch = resetPlayerOrder.orderedPlayers.slice(
        startIndex,
        startIndex + PLAYER_RESET_UPDATE_BATCH_SIZE,
      );

      const updateResults = await Promise.all(
        batch.map((player, batchIndex) =>
          supabase
            .from("Player")
            .update({
              status: "UNSOLD",
              teamId: null,
              importOrder: startIndex + batchIndex,
            })
            .eq("sessionId", sessionId)
            .eq("id", player.id),
        ),
      );

      const failedResult = updateResults.find((result) => result.error);
      if (failedResult?.error) throw failedResult.error;
    }

    const { error: resetSessionStateError } = await supabase
      .from("AuctionSession")
      .update({
        unsoldIterationRound: 1,
        unsoldIterationAnchorPlayerId: null,
        restartAckRequired: false,
        isAuctionEnded: false,
        auctionEndReason: null,
        endedAt: null,
      })
      .eq("id", sessionId);
    if (resetSessionStateError) throw resetSessionStateError;

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        resetAt: new Date().toISOString(),
        transactionsCleared: txCountResult.count ?? 0,
        teamsReset: teamCountResult.count ?? 0,
        playersUnsold: playerCountResult.count ?? 0,
        playerOrder: {
          reorderedPlayers: resetPlayerOrder.orderedPlayers.length,
          unknownRolePlayers: resetPlayerOrder.unknownRolePlayers,
          roles: resetPlayerOrder.roleSummaries,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to reset auction session", error);
    return NextResponse.json(
      { success: false, error: "Failed to reset auction session" },
      { status: 500 },
    );
  }
}
