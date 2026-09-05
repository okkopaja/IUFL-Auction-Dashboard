import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { tdPrisma } from "@/lib/teams-dist/prisma";
import { ensureTournamentSession } from "@/lib/teams-dist/tournamentSession";

export const dynamic = "force-dynamic";

/** GET /api/teams-dist/tournaments — list all tournaments */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const tournaments = await tdPrisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            teams: true,
            groupAssignments: true,
          },
        },
      },
    });

    const resolvedTournaments = await Promise.all(
      tournaments.map((tournament: { id: string }) =>
        ensureTournamentSession(tournament.id),
      ),
    );
    const supabase = getSupabaseAdminClient();
    const { data: activeSessions, error: activeSessionsError } = await supabase
      .from("AuctionSession")
      .select("id")
      .eq("isActive", true);

    if (activeSessionsError) throw activeSessionsError;
    const activeSessionIds = new Set(
      (activeSessions ?? []).map((session) => session.id),
    );

    const data = resolvedTournaments.map((resolved, index) => {
      // biome-ignore lint/suspicious/noExplicitAny: generated runtime type
      const originalTournament: any = tournaments[index];
      const t = {
        ...originalTournament,
        auctionSessionId:
          resolved?.sessionId ?? originalTournament.auctionSessionId,
      };

      return {
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        teamCount: t._count.teams,
        assignedCount: t._count.groupAssignments,
        isActive: t.auctionSessionId
          ? activeSessionIds.has(t.auctionSessionId)
          : false,
        _count: undefined,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error("Failed to fetch tournaments", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tournaments" },
      { status: 500 },
    );
  }
}

/** POST /api/teams-dist/tournaments — create a tournament */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const numberOfGroups =
      typeof body.numberOfGroups === "number" ? body.numberOfGroups : 4;
    const teamsPerGroup =
      typeof body.teamsPerGroup === "number" ? body.teamsPerGroup : 4;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Tournament name is required" },
        { status: 400 },
      );
    }

    // Validate configuration
    if (numberOfGroups < 1 || numberOfGroups > 16) {
      return NextResponse.json(
        { success: false, error: "Number of groups must be between 1 and 16" },
        { status: 400 },
      );
    }

    if (teamsPerGroup < 1 || teamsPerGroup > 16) {
      return NextResponse.json(
        { success: false, error: "Teams per group must be between 1 and 16" },
        { status: 400 },
      );
    }

    const totalTeams = numberOfGroups * teamsPerGroup;

    if (totalTeams > 64) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Total teams cannot exceed 64 (numberOfGroups × teamsPerGroup)",
        },
        { status: 400 },
      );
    }

    const tournament = await tdPrisma.tournament.create({
      data: {
        name,
        totalTeams,
        numberOfGroups,
        teamsPerGroup,
      },
    });

    const linked = await ensureTournamentSession(tournament.id);
    if (!linked) throw new Error("Failed to link tournament session");

    return NextResponse.json(
      {
        success: true,
        data: {
          ...linked.tournament,
          createdAt: linked.tournament.createdAt.toISOString(),
          updatedAt: linked.tournament.updatedAt.toISOString(),
          teamCount: 0,
          assignedCount: 0,
          isActive: false,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error("Failed to create tournament", error);
    return NextResponse.json(
      { success: false, error: "Failed to create tournament" },
      { status: 500 },
    );
  }
}
