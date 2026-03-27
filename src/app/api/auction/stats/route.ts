import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();

    const [playersRes, txRes] = await Promise.all([
      supabase.from("Player").select("status"),
      supabase.from("Transaction").select("amount"),
    ]);

    if (playersRes.error) throw playersRes.error;
    if (txRes.error) throw txRes.error;

    const players = playersRes.data || [];
    const transactions = txRes.data || [];

    const soldCount = players.filter((p) => p.status === "SOLD").length;
    const unsoldCount = players.filter(
      (p) => p.status === "UNSOLD" || p.status === "IN_AUCTION",
    ).length;
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalTeams = 16;

    return NextResponse.json({
      success: true,
      data: { soldCount, unsoldCount, totalSpent, totalTeams },
    });
  } catch (error) {
    logger.error("Failed to fetch stats", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
