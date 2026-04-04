import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { calculateTeamBidConstraints } from "@/lib/bidConstraints";
import { logger } from "@/lib/logger";
import { sortPlayersByAuctionOrder } from "@/lib/playerFilters";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { buildLatestTransactionAmountMap } from "@/lib/transactionAmounts";

export const dynamic = "force-dynamic";

const WATCHER_TEAM_SHORT_CODE = "SCP";

type SessionRow = {
  id: string;
  unsoldIterationRound: number | null;
  restartAckRequired: boolean | null;
  isAuctionEnded: boolean | null;
  auctionEndReason: "UNSOLD_DEPLETED" | "ITERATION_LIMIT_REACHED" | null;
};

type TeamRow = {
  id: string;
  name: string;
  shortCode: string;
  pointsTotal: number;
  pointsSpent: number;
};

type PlayerRow = {
  id: string;
  name: string;
  position1: string;
  importOrder: number;
};

export async function GET() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const supabase = getSupabaseAdminClient();

    const { data: sessionData, error: sessionError } = await supabase
      .from("AuctionSession")
      .select(
        "id,unsoldIterationRound,restartAckRequired,isAuctionEnded,auctionEndReason",
      )
      .eq("isActive", true)
      .limit(1)
      .maybeSingle();

    if (sessionError) throw sessionError;

    if (!sessionData) {
      return NextResponse.json({
        success: true,
        data: {
          team: null,
          players: [],
          meta: {
            hasActiveSession: false,
            hasWatcherTeam: false,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    }

    const session = sessionData as SessionRow;

    const { data: teamData, error: teamError } = await supabase
      .from("Team")
      .select("id,name,shortCode,pointsTotal,pointsSpent")
      .eq("sessionId", session.id)
      .eq("shortCode", WATCHER_TEAM_SHORT_CODE)
      .limit(1)
      .maybeSingle();

    if (teamError) throw teamError;

    if (!teamData) {
      return NextResponse.json({
        success: true,
        data: {
          team: null,
          players: [],
          meta: {
            hasActiveSession: true,
            hasWatcherTeam: false,
            sessionId: session.id,
            unsoldIterationRound: session.unsoldIterationRound ?? 1,
            restartAckRequired: Boolean(session.restartAckRequired),
            isAuctionEnded: Boolean(session.isAuctionEnded),
            auctionEndReason: session.auctionEndReason ?? null,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    }

    const team = teamData as TeamRow;

    const { data: playersData, error: playersError } = await supabase
      .from("Player")
      .select("id,name,position1,importOrder")
      .eq("sessionId", session.id)
      .eq("teamId", team.id)
      .eq("status", "SOLD");

    if (playersError) throw playersError;

    const basePlayers = sortPlayersByAuctionOrder(
      ((playersData ?? []) as PlayerRow[]).map((player) => ({
        ...player,
        status: "SOLD" as const,
      })),
    );

    const playerIds = basePlayers.map((player) => player.id);
    let amountByPlayerId = new Map<string, number>();

    if (playerIds.length > 0) {
      const { data: txData, error: txError } = await supabase
        .from("Transaction")
        .select("playerId,amount,createdAt")
        .eq("sessionId", session.id)
        .in("playerId", playerIds);

      if (txError) throw txError;
      amountByPlayerId = buildLatestTransactionAmountMap(txData ?? []);
    }

    const players = basePlayers.map((player) => ({
      id: player.id,
      name: player.name,
      position1: player.position1,
      importOrder: player.importOrder,
      amount: amountByPlayerId.get(player.id) ?? 0,
    }));

    const pointsRemaining = team.pointsTotal - team.pointsSpent;
    const constraints = calculateTeamBidConstraints({
      pointsRemaining,
      playersOwnedCount: players.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        team: {
          id: team.id,
          name: team.name,
          shortCode: team.shortCode,
          pointsTotal: team.pointsTotal,
          pointsSpent: team.pointsSpent,
          pointsRemaining,
          playersOwnedCount: players.length,
          maxBid: constraints.maxAllowedBid,
          canAffordMinimumBid: constraints.canAffordMinimumBid,
        },
        players,
        meta: {
          hasActiveSession: true,
          hasWatcherTeam: true,
          sessionId: session.id,
          unsoldIterationRound: session.unsoldIterationRound ?? 1,
          restartAckRequired: Boolean(session.restartAckRequired),
          isAuctionEnded: Boolean(session.isAuctionEnded),
          auctionEndReason: session.auctionEndReason ?? null,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error("Failed to fetch watchgod playground snapshot", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch watchgod playground snapshot" },
      { status: 500 },
    );
  }
}
