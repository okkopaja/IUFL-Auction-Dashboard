import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { tdPrisma } from "@/lib/teams-dist/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function serializeTeam(t: {
  id: string;
  tournamentId: string;
  name: string;
  shortName: string | null;
  country: string | null;
  crestUrl: string | null;
  seedPot: number | null;
  importedOrder: number;
  createdAt: Date;
  groupAssignment: {
    id: string;
    tournamentId: string;
    teamId: string;
    groupName: string;
    slotIndex: number;
    drawMode: string;
    actionId: string;
    assignedAt: Date;
  } | null;
}) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    groupAssignment: t.groupAssignment
      ? {
          ...t.groupAssignment,
          assignedAt: t.groupAssignment.assignedAt.toISOString(),
        }
      : null,
  };
}

/** GET /api/teams-dist/tournaments/[id]/teams — list teams */
export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: tournamentId } = await params;

    const teams = await tdPrisma.tdTeam.findMany({
      where: { tournamentId },
      include: { groupAssignment: true },
      orderBy: { importedOrder: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: teams.map(serializeTeam),
    });
  } catch (error) {
    logger.error("Failed to fetch teams", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

/** POST /api/teams-dist/tournaments/[id]/teams — add a single team */
export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: tournamentId } = await params;
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Team name is required" },
        { status: 400 }
      );
    }

    // Check duplicate within tournament
    const existing = await tdPrisma.tdTeam.findFirst({
      where: { tournamentId, name },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Team "${name}" already exists` },
        { status: 409 }
      );
    }

    // Count existing teams
    const count = await tdPrisma.tdTeam.count({ where: { tournamentId } });
    if (count >= 16) {
      return NextResponse.json(
        { success: false, error: "Tournament already has 16 teams (maximum)" },
        { status: 422 }
      );
    }

    const team = await tdPrisma.tdTeam.create({
      data: {
        tournamentId,
        name,
        shortName:
          typeof body.shortName === "string" ? body.shortName.trim() || null : null,
        country:
          typeof body.country === "string" ? body.country.trim() || null : null,
        crestUrl:
          typeof body.crestUrl === "string" ? body.crestUrl.trim() || null : null,
        seedPot:
          typeof body.seedPot === "number" ? body.seedPot : null,
        importedOrder: count,
      },
      include: { groupAssignment: true },
    });

    // Update tournament status
    const newCount = count + 1;
    if (newCount >= 16) {
      await tdPrisma.tournament.update({
        where: { id: tournamentId },
        data: { status: "TEAMS_READY" },
      });
    }

    return NextResponse.json(
      { success: true, data: serializeTeam(team) },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Failed to add team", error);
    return NextResponse.json(
      { success: false, error: "Failed to add team" },
      { status: 500 }
    );
  }
}
