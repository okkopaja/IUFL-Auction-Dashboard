import { NextResponse } from "next/server";
import { PLAYER_BASE_PRICE } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase";
import { mapTeamRoleProfiles } from "@/lib/teamRoles";
import { withTransactionAmounts } from "@/lib/transactionAmounts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();

    const { data: teamsData, error } = await supabase
      .from("Team")
      .select(`
        *,
        players:Player(*),
        roleProfiles:TeamRoleProfile(*),
        transactions:Transaction(*)
      `)
      .order("name");

    if (error) throw error;

    const teams = teamsData.map((t) => {
      const roleProfiles = t.roleProfiles ?? [];

      return {
        ...t,
        ...mapTeamRoleProfiles(roleProfiles),
        roleProfiles,
        players: withTransactionAmounts(
          (t.players ?? []).map((player) => ({
            ...player,
            basePrice: PLAYER_BASE_PRICE,
          })),
          (t.transactions ?? []).map((transaction) => ({
            playerId: transaction.playerId,
            amount: transaction.amount,
            createdAt: transaction.createdAt,
          })),
        ),
        pointsRemaining: t.pointsTotal - t.pointsSpent,
        playersOwnedCount: t.players?.length || 0,
      };
    });

    return NextResponse.json({ success: true, data: teams });
  } catch (error) {
    logger.error("Failed to fetch teams", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch teams" },
      { status: 500 },
    );
  }
}
