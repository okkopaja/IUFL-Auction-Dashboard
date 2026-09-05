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
  numberOfGroups: number;
  teamsPerGroup: number;
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
        { status: 404 },
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
      { status: 500 },
    );
  }
}

/** PATCH /api/teams-dist/tournaments/[id] — update name/status/configuration */
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await req.json();

    // Fetch current tournament to validate state
    const current = await tdPrisma.tournament.findUnique({
      where: { id },
      include: { _count: { select: { teams: true } } },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, error: "Tournament not found" },
        { status: 404 },
      );
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }

    if (typeof body.status === "string") {
      updates.status = body.status;
    }

    // Allow updating numberOfGroups and teamsPerGroup only during SETUP
    if (current.status === "SETUP") {
      if (typeof body.numberOfGroups === "number") {
        if (body.numberOfGroups < 1 || body.numberOfGroups > 16) {
          return NextResponse.json(
            {
              success: false,
              error: "Number of groups must be between 1 and 16",
            },
            { status: 400 },
          );
        }
        updates.numberOfGroups = body.numberOfGroups;
      }

      if (typeof body.teamsPerGroup === "number") {
        if (body.teamsPerGroup < 1 || body.teamsPerGroup > 16) {
          return NextResponse.json(
            {
              success: false,
              error: "Teams per group must be between 1 and 16",
            },
            { status: 400 },
          );
        }
        updates.teamsPerGroup = body.teamsPerGroup;
      }

      // Recalculate totalTeams if either config changed
      if (updates.numberOfGroups || updates.teamsPerGroup) {
        const numGroups = (updates.numberOfGroups ??
          current.numberOfGroups) as number;
        const teamsPerGrp = (updates.teamsPerGroup ??
          current.teamsPerGroup) as number;
        const totalTeams = numGroups * teamsPerGrp;

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

        updates.totalTeams = totalTeams;
      }
    }

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
      { status: 500 },
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
      { status: 500 },
    );
  }
}
