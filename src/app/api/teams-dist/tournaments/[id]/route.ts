import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { tdPrisma } from "@/lib/teams-dist/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function serializeTournament(t: {
  id: string;
  name: string;
  formatType: string;
  totalTeams: number;
  status: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** GET /api/teams-dist/tournaments/[id] */
export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;

    const tournament = await tdPrisma.tournament.findUnique({
      where: { id },
      include: {
        _count: { select: { teams: true, groupAssignments: true } },
      },
    });

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: "Tournament not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...serializeTournament(tournament),
        teamCount: tournament._count.teams,
        assignedCount: tournament._count.groupAssignments,
        _count: undefined,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch tournament", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tournament" },
      { status: 500 }
    );
  }
}

/** PATCH /api/teams-dist/tournaments/[id] — update name/status */
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, string> = {};
    if (typeof body.name === "string" && body.name.trim())
      updates.name = body.name.trim();
    if (typeof body.status === "string") updates.status = body.status;

    const tournament = await tdPrisma.tournament.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      success: true,
      data: serializeTournament(tournament),
    });
  } catch (error) {
    logger.error("Failed to update tournament", error);
    return NextResponse.json(
      { success: false, error: "Failed to update tournament" },
      { status: 500 }
    );
  }
}

/** DELETE /api/teams-dist/tournaments/[id] */
export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    await tdPrisma.tournament.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to delete tournament", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete tournament" },
      { status: 500 }
    );
  }
}
