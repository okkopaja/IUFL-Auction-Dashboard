import { NextResponse } from "next/server";
import {
  buildTeamWiseExport,
  type TeamWiseExportPlayerStatus,
} from "@/features/player-export/teamWiseExport";
import { TRIAL_ABSENTEE_PLAYERS } from "@/lib/absenteePlayers";
import { requireSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
};

type TeamRow = {
  id: string;
  name: string;
};

type PlayerRow = {
  id: string;
  name: string;
  status: string;
  teamId: string | null;
  position1: string | null;
  importOrder: number | null;
};

function toPlayerStatus(status: string): TeamWiseExportPlayerStatus {
  if (status === "SOLD" || status === "IN_AUCTION" || status === "UNSOLD") {
    return status;
  }

  return "UNSOLD";
}

export async function GET() {
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

    const sessionId = (session as SessionRow).id;

    const [teamsResult, playersResult] = await Promise.all([
      supabase
        .from("Team")
        .select("id,name")
        .eq("sessionId", sessionId)
        .order("name", { ascending: true }),
      supabase
        .from("Player")
        .select("id,name,status,teamId,position1,importOrder")
        .eq("sessionId", sessionId)
        .order("importOrder", { ascending: true }),
    ]);

    if (teamsResult.error) throw teamsResult.error;
    if (playersResult.error) throw playersResult.error;

    const exportData = buildTeamWiseExport({
      teams: (teamsResult.data ?? []) as TeamRow[],
      players: ((playersResult.data ?? []) as PlayerRow[]).map((player) => ({
        id: player.id,
        name: player.name,
        status: toPlayerStatus(player.status),
        teamId: player.teamId,
        position1: player.position1,
        importOrder: player.importOrder,
      })),
      absenteeNames: TRIAL_ABSENTEE_PLAYERS,
    });

    return NextResponse.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    logger.error("Failed to build team-wise player export", error);
    return NextResponse.json(
      { success: false, error: "Failed to build team-wise player export" },
      { status: 500 },
    );
  }
}
