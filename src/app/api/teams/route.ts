import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();

    const { data: teamsData, error } = await supabase
      .from("Team")
      .select(`
        *,
        players:Player(*),
        transactions:Transaction(*)
      `)
      .order("name");

    if (error) throw error;

    const teams = teamsData.map((t) => ({
      ...t,
      pointsRemaining: t.pointsTotal - t.pointsSpent,
      playersOwnedCount: t.players?.length || 0,
    }));

    return NextResponse.json({ success: true, data: teams });
  } catch (error) {
    logger.error("Failed to fetch teams", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch teams" },
      { status: 500 },
    );
  }
}
