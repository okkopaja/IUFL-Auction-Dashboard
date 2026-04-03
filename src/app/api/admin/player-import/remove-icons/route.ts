import { type NextRequest, NextResponse } from "next/server";
import { loadIconNameSetForSession } from "@/features/player-import/iconLookup";
import { filterRowsByIconName } from "@/features/player-import/iconNames";
import { requireSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

function uniqueSortedNames(rows: Array<{ name: string }>): string[] {
  return [...new Set(rows.map((row) => row.name.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}

export async function POST(_req: NextRequest) {
  const denied = await requireSuperAdmin();
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
      return NextResponse.json(
        { success: false, error: "No active auction session found" },
        { status: 404 },
      );
    }

    const sessionId = session.id;
    const iconNameSet = await loadIconNameSetForSession(supabase, sessionId);

    if (iconNameSet.size === 0) {
      return NextResponse.json({
        success: true,
        data: {
          sessionId,
          iconProfilesFoundCount: 0,
          matchedCount: 0,
          removedCount: 0,
          blockedCount: 0,
          removedNames: [] as string[],
          blockedPlayers: [] as Array<{ name: string; status: string }>,
        },
      });
    }

    const { data: players, error: playersError } = await supabase
      .from("Player")
      .select("id,name,status")
      .eq("sessionId", sessionId);

    if (playersError) throw playersError;

    const iconPlayersInBase = filterRowsByIconName(players ?? [], iconNameSet);
    const removablePlayers = iconPlayersInBase.filter(
      (player) => player.status === "UNSOLD",
    );
    const blockedPlayers = iconPlayersInBase.filter(
      (player) => player.status !== "UNSOLD",
    );

    if (removablePlayers.length > 0) {
      const removablePlayerIds = removablePlayers.map((player) => player.id);

      const { error: deleteImageJobsError } = await supabase
        .from("ImportImageIngestionJob")
        .delete()
        .eq("sessionId", sessionId)
        .in("playerId", removablePlayerIds);

      if (deleteImageJobsError) throw deleteImageJobsError;

      const { error: deleteError } = await supabase
        .from("Player")
        .delete()
        .eq("sessionId", sessionId)
        .in("id", removablePlayerIds);

      if (deleteError) throw deleteError;
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        iconProfilesFoundCount: iconNameSet.size,
        matchedCount: iconPlayersInBase.length,
        removedCount: removablePlayers.length,
        blockedCount: blockedPlayers.length,
        removedNames: uniqueSortedNames(removablePlayers),
        blockedPlayers: blockedPlayers.map((player) => ({
          name: player.name,
          status: player.status,
        })),
      },
    });
  } catch (error) {
    logger.error("Failed to remove icon players from player base", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove icon players" },
      { status: 500 },
    );
  }
}
