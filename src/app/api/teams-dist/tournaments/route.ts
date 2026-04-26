import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { tdPrisma } from "@/lib/teams-dist/prisma";
import { logger } from "@/lib/logger";

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

    // biome-ignore lint/suspicious/noExplicitAny: generated runtime type
    const data = tournaments.map((t: any) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      teamCount: t._count.teams,
      assignedCount: t._count.groupAssignments,
      _count: undefined,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error("Failed to fetch tournaments", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tournaments" },
      { status: 500 }
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

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Tournament name is required" },
        { status: 400 }
      );
    }

    const tournament = await tdPrisma.tournament.create({
      data: { name },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...tournament,
          createdAt: tournament.createdAt.toISOString(),
          updatedAt: tournament.updatedAt.toISOString(),
          teamCount: 0,
          assignedCount: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Failed to create tournament", error);
    return NextResponse.json(
      { success: false, error: "Failed to create tournament" },
      { status: 500 }
    );
  }
}
