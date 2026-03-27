import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: team, error } = await supabase
      .from("Team")
      .select(`
        *,
        players:Player(*),
        transactions:Transaction(*)
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!team)
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );

    const players = team.players || [];
    return NextResponse.json({
      success: true,
      data: {
        ...team,
        pointsRemaining: team.pointsTotal - team.pointsSpent,
        playersOwnedCount: players.length,
        players,
        transactions: team.transactions || [],
      },
    });
  } catch (error) {
    logger.error("Failed to fetch team", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
