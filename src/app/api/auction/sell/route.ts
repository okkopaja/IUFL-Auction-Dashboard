import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  // ── Auth guard ──────────────────────────────────────────────────────────
  const denied = await requireAdmin();
  if (denied) return denied;
  // ────────────────────────────────────────────────────────────────────────

  try {
    const { playerId, teamId, amount } = await req.json();
    if (!playerId || !teamId || !amount) {
      return NextResponse.json(
        { success: false, error: "Invalid data" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdminClient();

    const { data: playerInfo } = await supabase
      .from("Player")
      .select("sessionId")
      .eq("id", playerId)
      .single();

    if (!playerInfo)
      return NextResponse.json(
        { success: false, error: "Player not found" },
        { status: 404 },
      );

    // Mark player as SOLD
    const { error: pErr } = await supabase
      .from("Player")
      .update({ status: "SOLD", teamId })
      .eq("id", playerId);

    if (pErr) throw pErr;

    // Create transaction
    const { data: transaction, error: tErr } = await supabase
      .from("Transaction")
      .insert({
        id: crypto.randomUUID(),
        playerId,
        teamId,
        amount,
        sessionId: playerInfo.sessionId,
      })
      .select("*")
      .single();

    if (tErr) throw tErr;

    return NextResponse.json({
      success: true,
      data: { transaction, nextPlayer: null },
    });
  } catch (error) {
    logger.error("Failed to sell player", error);
    return NextResponse.json(
      { success: false, error: "Failed to sell player" },
      { status: 500 },
    );
  }
}
