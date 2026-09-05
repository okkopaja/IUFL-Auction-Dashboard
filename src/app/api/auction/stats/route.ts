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

    const { data: session, error: sessionError } = await supabase
      .from("AuctionSession")
      .select("id")
      .eq("isActive", true)
      .limit(1)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      return NextResponse.json({
        success: true,
        data: {
          soldCount: 0,
          unsoldCount: 0,
          totalSpent: 0,
          totalTeams: 0,
          totalPlayers: 0,
        },
      });
    }

    const [playersRes, txRes, teamsRes] = await Promise.all([
      supabase.from("Player").select("status").eq("sessionId", session.id),
      supabase.from("Transaction").select("amount").eq("sessionId", session.id),
      supabase.from("Team").select("id").eq("sessionId", session.id),
    ]);

    if (playersRes.error) throw playersRes.error;
    if (txRes.error) throw txRes.error;
    if (teamsRes.error) throw teamsRes.error;

    const players = playersRes.data || [];
    const transactions = txRes.data || [];

    const soldCount = players.filter((p) => p.status === "SOLD").length;
    const unsoldCount = players.filter(
      (p) => p.status === "UNSOLD" || p.status === "IN_AUCTION",
    ).length;
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalTeams = teamsRes.data?.length ?? 0;
    const totalPlayers = players.length;

    return NextResponse.json({
      success: true,
      data: { soldCount, unsoldCount, totalSpent, totalTeams, totalPlayers },
    });
  } catch (error) {
    logger.error("Failed to fetch stats", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
