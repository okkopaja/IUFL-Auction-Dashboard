import { NextResponse } from "next/server";
import { requireAuctionAccess } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type AuctionHistoryRow = {
  id: string;
  actionType: "PASS" | "SELL";
  createdAt: string;
  fromPlayerId: string;
  toPlayerId: string | null;
  transactionId: string | null;
};

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

async function getLatestHistoryRow(
  sessionId: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const { data, error } = await supabase
    .from("AuctionActionHistory")
    .select("id,actionType,createdAt,fromPlayerId,toPlayerId,transactionId")
    .eq("sessionId", sessionId)
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as AuctionHistoryRow | null) ?? null;
}

async function buildHistoryPreviewPayload(
  sessionId: string,
  history: AuctionHistoryRow,
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const [fromPlayerRes, toPlayerRes, transactionRes] = await Promise.all([
    supabase
      .from("Player")
      .select("*")
      .eq("id", history.fromPlayerId)
      .eq("sessionId", sessionId)
      .maybeSingle(),
    history.toPlayerId
      ? supabase
          .from("Player")
          .select("*")
          .eq("id", history.toPlayerId)
          .eq("sessionId", sessionId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    history.transactionId
      ? supabase
          .from("Transaction")
          .select(
            "id,playerId,teamId,sessionId,amount,createdAt,player:Player(*),team:Team(*)",
          )
          .eq("id", history.transactionId)
          .eq("sessionId", sessionId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (fromPlayerRes.error) throw fromPlayerRes.error;
  if (toPlayerRes.error) throw toPlayerRes.error;
  if (transactionRes.error) throw transactionRes.error;

  if (!fromPlayerRes.data) {
    return null;
  }

  return {
    id: history.id,
    actionType: history.actionType,
    createdAt: history.createdAt,
    fromPlayer: fromPlayerRes.data,
    toPlayer: toPlayerRes.data,
    transaction: transactionRes.data,
  };
}

export async function GET() {
  const denied = await requireAuctionAccess();
  if (denied) return denied;

  try {
    const { supabase, sessionId } = await getActiveSessionId();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "No active auction session found" },
        { status: 404 },
      );
    }

    const latestHistory = await getLatestHistoryRow(sessionId, supabase);

    if (!latestHistory) {
      return NextResponse.json({ success: true, data: null });
    }

    const preview = await buildHistoryPreviewPayload(
      sessionId,
      latestHistory,
      supabase,
    );

    if (!preview) {
      return NextResponse.json(
        { success: false, error: "Previous player could not be loaded" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    logger.error("Failed to fetch previous player", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch previous player" },
      { status: 500 },
    );
  }
}

export async function POST() {
  const denied = await requireAuctionAccess();
  if (denied) return denied;

  try {
    const { supabase, sessionId } = await getActiveSessionId();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "No active auction session found" },
        { status: 404 },
      );
    }

    const latestHistory = await getLatestHistoryRow(sessionId, supabase);

    if (!latestHistory) {
      return NextResponse.json(
        { success: false, error: "No previous action available" },
        { status: 409 },
      );
    }

    if (latestHistory.actionType === "SELL") {
      const preview = await buildHistoryPreviewPayload(
        sessionId,
        latestHistory,
        supabase,
      );

      if (!preview) {
        return NextResponse.json(
          { success: false, error: "Previous player could not be loaded" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          mode: "SELL_PREVIEW",
          entry: preview,
        },
      });
    }

    const { data: fromPlayer, error: fromPlayerError } = await supabase
      .from("Player")
      .select("*")
      .eq("id", latestHistory.fromPlayerId)
      .eq("sessionId", sessionId)
      .maybeSingle();

    if (fromPlayerError) throw fromPlayerError;

    if (!fromPlayer) {
      return NextResponse.json(
        { success: false, error: "Previous pass target no longer exists" },
        { status: 409 },
      );
    }

    let livePlayer = fromPlayer;

    if (fromPlayer.status === "SOLD") {
      return NextResponse.json(
        {
          success: false,
          error: "Previous pass target is sold and cannot be restored live",
        },
        { status: 409 },
      );
    }

    if (fromPlayer.status === "UNSOLD") {
      const { data: promotedPlayer, error: promoteError } = await supabase
        .from("Player")
        .update({ status: "IN_AUCTION" })
        .eq("id", fromPlayer.id)
        .eq("sessionId", sessionId)
        .eq("status", "UNSOLD")
        .select("*")
        .maybeSingle();

      if (promoteError) throw promoteError;

      if (!promotedPlayer) {
        return NextResponse.json(
          {
            success: false,
            error: "Previous player state changed. Please retry.",
          },
          { status: 409 },
        );
      }

      livePlayer = promotedPlayer;
    }

    const { error: resetOthersError } = await supabase
      .from("Player")
      .update({ status: "UNSOLD" })
      .eq("sessionId", sessionId)
      .eq("status", "IN_AUCTION")
      .neq("id", livePlayer.id);

    if (resetOthersError) throw resetOthersError;

    const { error: consumeHistoryError } = await supabase
      .from("AuctionActionHistory")
      .delete()
      .eq("id", latestHistory.id)
      .eq("sessionId", sessionId);

    if (consumeHistoryError) throw consumeHistoryError;

    return NextResponse.json({
      success: true,
      data: {
        mode: "PASS_REVERTED",
        consumedActionId: latestHistory.id,
        currentPlayer: livePlayer,
      },
    });
  } catch (error) {
    logger.error("Failed to process previous action", error);
    return NextResponse.json(
      { success: false, error: "Failed to process previous action" },
      { status: 500 },
    );
  }
}
