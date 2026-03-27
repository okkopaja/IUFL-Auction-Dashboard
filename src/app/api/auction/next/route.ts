import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST() {
  // ── Auth guard ──────────────────────────────────────────────────────────
  const denied = await requireAdmin();
  if (denied) return denied;
  // ────────────────────────────────────────────────────────────────────────

  try {
    const supabase = await getSupabaseServerClient();

    // Find next unsold player assuming there isn't a current one
    const { data: nextUnsold, error } = await supabase
      .from("Player")
      .select("*")
      .eq("status", "UNSOLD")
      .order("importOrder")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (nextUnsold) {
      await supabase
        .from("Player")
        .update({ status: "IN_AUCTION" })
        .eq("id", nextUnsold.id);
      nextUnsold.status = "IN_AUCTION";
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
