import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { activateTournament } from "@/lib/teams-dist/tournamentSession";

export const dynamic = "force-dynamic";

/** POST /api/teams-dist/tournaments/[id]/switch */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const result = await activateTournament(id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Tournament not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tournamentId: result.tournament.id,
        auctionSessionId: result.sessionId,
      },
    });
  } catch (error) {
    logger.error("Failed to switch tournament", error);
    return NextResponse.json(
      { success: false, error: "Failed to switch tournament" },
      { status: 500 },
    );
  }
}
