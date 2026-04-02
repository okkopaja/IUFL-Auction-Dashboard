import { NextResponse } from "next/server";
import { PLAYER_BASE_PRICE } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase";
import { mapTeamRoleProfiles } from "@/lib/teamRoles";
import { withTransactionAmounts } from "@/lib/transactionAmounts";

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
        roleProfiles:TeamRoleProfile(*),
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

    const players = withTransactionAmounts(
      (team.players || []).map((player) => ({
        ...player,
        basePrice: PLAYER_BASE_PRICE,
      })),
      (team.transactions || []).map((transaction) => ({
        playerId: transaction.playerId,
        amount: transaction.amount,
        createdAt: transaction.createdAt,
      })),
    );
    return NextResponse.json({
      success: true,
      data: {
        ...team,
        ...mapTeamRoleProfiles(team.roleProfiles ?? []),
        pointsRemaining: team.pointsTotal - team.pointsSpent,
        playersOwnedCount: players.length,
        players,
        roleProfiles: team.roleProfiles || [],
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
