import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { calculateTeamBidConstraints } from "@/lib/bidConstraints";
import { PLAYER_BASE_PRICE } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { sortPlayersByAuctionOrder } from "@/lib/playerFilters";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { buildLatestTransactionAmountMap } from "@/lib/transactionAmounts";

export const dynamic = "force-dynamic";

const WATCHGOD_PAGE_SIZE = 15;

type SessionRow = {
  id: string;
  unsoldIterationRound: number | null;
  restartAckRequired: boolean | null;
  isAuctionEnded: boolean | null;
  auctionEndReason: "UNSOLD_DEPLETED" | "ITERATION_LIMIT_REACHED" | null;
};

type PlayerRow = {
  id: string;
  name: string;
  position1: string;
  importOrder: number;
  status: "UNSOLD" | "IN_AUCTION" | "SOLD";
  teamId: string | null;
  team: {
    id: string;
    name: string;
    shortCode: string;
  } | null;
};

type TeamRow = {
  id: string;
  name: string;
  shortCode: string;
  pointsTotal: number;
  pointsSpent: number;
};

type HistoryRow = {
  id: string;
  actionType: "PASS" | "SELL";
  createdAt: string;
  fromPlayerId: string;
};

type WatchgodPlayer = {
  id: string;
  name: string;
  position1: string;
  importOrder: number;
  status: "UNSOLD" | "IN_AUCTION" | "SOLD";
  teamId: string | null;
  teamShortCode: string | null;
  transactionAmount: number | null;
};

type WatchgodProgressionRow = {
  id: string;
  queueType: "PASSED" | "CURRENT" | "UPCOMING";
  actionType: "PASS" | "SELL" | null;
  actionAt: string | null;
  player: WatchgodPlayer;
};

function buildUpcomingPlayers(
  orderedPlayers: WatchgodPlayer[],
  currentPlayerId: string | null,
): WatchgodPlayer[] {
  if (orderedPlayers.length === 0) {
    return [];
  }

  if (!currentPlayerId) {
    return orderedPlayers.filter((player) => player.status === "UNSOLD");
  }

  const currentIndex = orderedPlayers.findIndex(
    (player) => player.id === currentPlayerId,
  );

  if (currentIndex === -1) {
    return orderedPlayers.filter((player) => player.status === "UNSOLD");
  }

  const upcoming: WatchgodPlayer[] = [];
  for (let offset = 1; offset < orderedPlayers.length; offset += 1) {
    const candidate =
      orderedPlayers[(currentIndex + offset) % orderedPlayers.length];

    if (candidate.status === "UNSOLD") {
      upcoming.push(candidate);
    }
  }

  return upcoming;
}

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
          progression: [] as WatchgodProgressionRow[],
          teams: [] as Array<{
            id: string;
            name: string;
            shortCode: string;
            pointsTotal: number;
            pointsSpent: number;
            pointsRemaining: number;
            playersOwnedCount: number;
            maxBid: number;
            canAffordMinimumBid: boolean;
          }>,
          meta: {
            hasActiveSession: false,
            sessionId: null,
            currentPlayerId: null,
            unsoldIterationRound: 1,
            restartAckRequired: false,
            isAuctionEnded: false,
            auctionEndReason: null,
            passedCount: 0,
            upcomingCount: 0,
            totalProgressionCount: 0,
            pageSize: WATCHGOD_PAGE_SIZE,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    }

    const session = sessionData as SessionRow;

    const [playersRes, transactionsRes, historyRes, teamsRes] =
      await Promise.all([
        supabase
          .from("Player")
          .select(
            "id,name,position1,importOrder,status,teamId,team:Team(id,name,shortCode)",
          )
          .eq("sessionId", session.id),
        supabase
          .from("Transaction")
          .select("playerId,amount,createdAt")
          .eq("sessionId", session.id),
        supabase
          .from("AuctionActionHistory")
          .select("id,actionType,createdAt,fromPlayerId")
          .eq("sessionId", session.id)
          .order("createdAt", { ascending: false })
          .limit(5),
        supabase
          .from("Team")
          .select("id,name,shortCode,pointsTotal,pointsSpent")
          .eq("sessionId", session.id)
          .order("name"),
      ]);

    if (playersRes.error) throw playersRes.error;
    if (transactionsRes.error) throw transactionsRes.error;
    if (historyRes.error) throw historyRes.error;
    if (teamsRes.error) throw teamsRes.error;

    const transactionAmountByPlayerId = buildLatestTransactionAmountMap(
      transactionsRes.data ?? [],
    );

    const orderedPlayers = sortPlayersByAuctionOrder(
      ((playersRes.data ?? []) as PlayerRow[]).map((player) => ({
        ...player,
        transactionAmount: transactionAmountByPlayerId.get(player.id) ?? null,
        basePrice: PLAYER_BASE_PRICE,
        teamShortCode: player.team?.shortCode ?? null,
      })),
    ).map((player) => ({
      id: player.id,
      name: player.name,
      position1: player.position1,
      importOrder: player.importOrder,
      status: player.status,
      teamId: player.teamId,
      teamShortCode: player.teamShortCode,
      transactionAmount: player.transactionAmount,
    }));

    const playerById = new Map(
      orderedPlayers.map((player) => [player.id, player]),
    );

    const currentPlayer =
      orderedPlayers.find((player) => player.status === "IN_AUCTION") ?? null;

    const passedRows = ((historyRes.data ?? []) as HistoryRow[])
      .slice()
      .reverse()
      .map((history) => {
        const player = playerById.get(history.fromPlayerId);
        if (!player) return null;

        return {
          id: history.id,
          queueType: "PASSED",
          actionType: history.actionType,
          actionAt: history.createdAt,
          player,
        } satisfies WatchgodProgressionRow;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const upcomingPlayers = buildUpcomingPlayers(
      orderedPlayers,
      currentPlayer?.id ?? null,
    );

    const progression: WatchgodProgressionRow[] = [
      ...passedRows,
      ...(currentPlayer
        ? [
            {
              id: `current-${currentPlayer.id}`,
              queueType: "CURRENT",
              actionType: null,
              actionAt: null,
              player: currentPlayer,
            } satisfies WatchgodProgressionRow,
          ]
        : []),
      ...upcomingPlayers.map((player, index) => ({
        id: `upcoming-${player.id}-${index}`,
        queueType: "UPCOMING" as const,
        actionType: null,
        actionAt: null,
        player,
      })),
    ];

    const playersOwnedCountByTeamId = new Map<string, number>();
    for (const player of orderedPlayers) {
      if (!player.teamId) continue;

      playersOwnedCountByTeamId.set(
        player.teamId,
        (playersOwnedCountByTeamId.get(player.teamId) ?? 0) + 1,
      );
    }

    const teams = ((teamsRes.data ?? []) as TeamRow[])
      .map((team) => {
        const pointsRemaining = team.pointsTotal - team.pointsSpent;
        const playersOwnedCount = playersOwnedCountByTeamId.get(team.id) ?? 0;
        const constraints = calculateTeamBidConstraints({
          pointsRemaining,
          playersOwnedCount,
        });

        return {
          id: team.id,
          name: team.name,
          shortCode: team.shortCode,
          pointsTotal: team.pointsTotal,
          pointsSpent: team.pointsSpent,
          pointsRemaining,
          playersOwnedCount,
          maxBid: constraints.maxAllowedBid,
          canAffordMinimumBid: constraints.canAffordMinimumBid,
        };
      })
      .sort(
        (a, b) =>
          b.pointsRemaining - a.pointsRemaining ||
          b.maxBid - a.maxBid ||
          a.name.localeCompare(b.name),
      );

    return NextResponse.json({
      success: true,
      data: {
        progression,
        teams,
        meta: {
          hasActiveSession: true,
          sessionId: session.id,
          currentPlayerId: currentPlayer?.id ?? null,
          unsoldIterationRound: session.unsoldIterationRound ?? 1,
          restartAckRequired: Boolean(session.restartAckRequired),
          isAuctionEnded: Boolean(session.isAuctionEnded),
          auctionEndReason: session.auctionEndReason ?? null,
          passedCount: passedRows.length,
          upcomingCount: upcomingPlayers.length,
          totalProgressionCount: progression.length,
          pageSize: WATCHGOD_PAGE_SIZE,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error("Failed to fetch watchgod snapshot", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch watchgod snapshot" },
      { status: 500 },
    );
  }
}
