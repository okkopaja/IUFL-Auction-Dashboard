import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/auth";
import {
  DrawEngineError,
  executeBatchDraw,
  executeResetSession,
  executeSingleDraw,
  executeUndo,
} from "@/lib/teams-dist/drawEngine";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/teams-dist/tournaments/[id]/draw
 *
 * Body: { mode: "single" | "batch" | "undo" | "reset" }
 */
export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: tournamentId } = await params;
    const { userId } = await auth();
    const body = await req.json();
    const mode = body?.mode;

    if (!["single", "batch", "undo", "reset"].includes(mode)) {
      return NextResponse.json(
        { success: false, error: 'mode must be "single", "batch", "undo", or "reset"' },
        { status: 400 }
      );
    }

    let result;
    if (mode === "single") {
      result = await executeSingleDraw(tournamentId, userId ?? undefined);
    } else if (mode === "batch") {
      result = await executeBatchDraw(tournamentId, userId ?? undefined);
    } else if (mode === "reset") {
      await executeResetSession(tournamentId, userId ?? undefined);
      result = { mode: "reset" as const };
    } else {
      result = await executeUndo(tournamentId);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof DrawEngineError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 422 }
      );
    }
    logger.error("Draw engine error", error);
    return NextResponse.json(
      { success: false, error: "Draw operation failed" },
      { status: 500 }
    );
  }
}

