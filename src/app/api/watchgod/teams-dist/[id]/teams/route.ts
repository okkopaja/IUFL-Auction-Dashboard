import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { tdPrisma } from "@/lib/teams-dist/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/watchgod/teams-dist/[id]/teams
 * Returns all teams with their current group assignment and any staged watchdog assignment.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const { id: tournamentId } = await params;

    const [teams, staged] = await Promise.all([
      tdPrisma.tdTeam.findMany({
        where: { tournamentId },
        include: { groupAssignment: true },
        orderBy: { importedOrder: "asc" },
      }),
      tdPrisma.tdWatchdogStage.findMany({
        where: { tournamentId },
      }),
    ]);

    const stagedMap = new Map(staged.map((s: { teamId: string; groupName: string; drawMode: string; id: string }) => [s.teamId, s]));

    const data = teams.map((t: { id: string; name: string; shortName: string | null; country: string | null; seedPot: number | null; groupAssignment: { groupName: string; drawMode: string } | null }) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      country: t.country,
      seedPot: t.seedPot,
      assignedGroup: t.groupAssignment?.groupName ?? null,
      drawMode: t.groupAssignment?.drawMode ?? null,
      stagedGroup: (stagedMap.get(t.id) as { groupName: string; drawMode: string; id: string } | undefined)?.groupName ?? null,
      stagedDrawMode: (stagedMap.get(t.id) as { groupName: string; drawMode: string; id: string } | undefined)?.drawMode ?? null,
      stagedId: (stagedMap.get(t.id) as { groupName: string; drawMode: string; id: string } | undefined)?.id ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error("Watchdog teams fetch error", error);
    return NextResponse.json(
      { success: false, error: "Failed to load teams" },
      { status: 500 }
    );
  }
}
