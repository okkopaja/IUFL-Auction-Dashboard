import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { tdPrisma } from "@/lib/teams-dist/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/watchgod/teams-dist/[id]/stage
 * Body: { teamId: string; groupName: string; drawMode: "SINGLE" | "BATCH" }
 *
 * Upserts a staged watchdog assignment for a team.
 * Send groupName: null to clear the staging.
 *
 * DELETE /api/watchgod/teams-dist/[id]/stage
 * Body: { teamId: string }  — clears the stage for that team.
 */
export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const { id: tournamentId } = await params;
    const body = await req.json();
    const { teamId, groupName, drawMode } = body ?? {};

    if (!teamId || typeof teamId !== "string") {
      return NextResponse.json(
        { success: false, error: "teamId is required" },
        { status: 400 }
      );
    }

    // Clear staging if groupName is null/empty
    if (!groupName) {
      await tdPrisma.tdWatchdogStage.deleteMany({
        where: { tournamentId, teamId },
      });
      return NextResponse.json({ success: true, data: { cleared: true } });
    }

    if (!["A", "B", "C", "D"].includes(groupName)) {
      return NextResponse.json(
        { success: false, error: "groupName must be A, B, C, or D" },
        { status: 400 }
      );
    }
    if (!["SINGLE", "BATCH"].includes(drawMode)) {
      return NextResponse.json(
        { success: false, error: "drawMode must be SINGLE or BATCH" },
        { status: 400 }
      );
    }

    // Upsert the staging row (delete old one for this team first, then create)
    await tdPrisma.$transaction(async (tx: any) => {
      await tx.tdWatchdogStage.deleteMany({
        where: { tournamentId, teamId },
      });
      await tx.tdWatchdogStage.create({
        data: { tournamentId, teamId, groupName, drawMode },
      });
    });

    return NextResponse.json({ success: true, data: { teamId, groupName, drawMode } });
  } catch (error) {
    logger.error("Watchdog stage error", error);
    return NextResponse.json(
      { success: false, error: "Failed to stage assignment" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const { id: tournamentId } = await params;
    const body = await req.json();
    const { teamId } = body ?? {};

    if (teamId) {
      await tdPrisma.tdWatchdogStage.deleteMany({
        where: { tournamentId, teamId },
      });
    } else {
      // Clear all staged assignments for this tournament
      await tdPrisma.tdWatchdogStage.deleteMany({ where: { tournamentId } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Watchdog clear stage error", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear staging" },
      { status: 500 }
    );
  }
}
