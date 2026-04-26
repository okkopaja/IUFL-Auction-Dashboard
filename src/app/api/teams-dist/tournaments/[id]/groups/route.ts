import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { tdPrisma } from "@/lib/teams-dist/prisma";
import { GROUP_NAMES, type GroupName } from "@/types/teams-dist";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/teams-dist/tournaments/[id]/groups
 *
 * Returns the full group board: A–D each with their assigned teams.
 * Also returns unassigned teams and the latest reversible action flag.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: tournamentId } = await params;

    const [teams, latestAction] = await Promise.all([
      tdPrisma.tdTeam.findMany({
        where: { tournamentId },
        include: { groupAssignment: true },
        orderBy: { importedOrder: "asc" },
      }),
      tdPrisma.tdDrawAction.findFirst({
        where: { tournamentId, reversible: true, reverted: false },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Serialise
    // biome-ignore lint/suspicious/noExplicitAny: generated runtime type
    const serializedTeams = teams.map((t: any) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      groupAssignment: t.groupAssignment
        ? {
            ...t.groupAssignment,
            assignedAt: t.groupAssignment.assignedAt.toISOString(),
          }
        : null,
    }));

    // Build group board
    const groups = GROUP_NAMES.map((g: GroupName) => ({
      groupName: g,
      teams: serializedTeams
        .filter((t: any) => t.groupAssignment?.groupName === g)
        .sort(
          (a: any, b: any) =>
            (a.groupAssignment?.slotIndex ?? 0) -
            (b.groupAssignment?.slotIndex ?? 0)
        ),
      isFull:
        serializedTeams.filter((t: any) => t.groupAssignment?.groupName === g)
          .length >= 4,
      capacity: 4,
    }));

    const unassigned = serializedTeams.filter((t: any) => !t.groupAssignment);

    return NextResponse.json({
      success: true,
      data: {
        groups,
        unassigned,
        canUndo: !!latestAction,
        canDrawSingle: unassigned.length > 0,
        canDrawBatch: unassigned.length >= 4,
        isComplete: unassigned.length === 0,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch group board", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch group board" },
      { status: 500 }
    );
  }
}
