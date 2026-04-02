import { NextResponse } from "next/server";
import { requireAuctionAccess } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuctionAccess();
  if (denied) return denied;

  try {
    const supabase = getSupabaseAdminClient();

    const { data: logs, error } = await supabase
      .from("Transaction")
      .select(`
        *,
        player:Player(*),
        team:Team(*)
      `)
      .order("createdAt", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    logger.error("Failed to fetch logs", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch logs" },
      { status: 500 },
    );
  }
}
