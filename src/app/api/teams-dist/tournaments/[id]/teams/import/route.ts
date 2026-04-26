import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { tdPrisma } from "@/lib/teams-dist/prisma";
import { logger } from "@/lib/logger";
import type { TeamCsvRow } from "@/types/teams-dist";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/teams-dist/tournaments/[id]/teams/import
 *
 * Body: { teams: TeamCsvRow[] }   (parsed on client with Papa Parse, sent as JSON)
 *
 * Atomically replaces all non-assigned teams with the new set.
 * Validation:
 *  - Exactly 16 rows
 *  - All team_name values must be unique and non-empty
 *  - Cannot import while a draw is in progress / complete
 */
export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: tournamentId } = await params;

    const tournament = await tdPrisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      return NextResponse.json(
        { success: false, error: "Tournament not found" },
        { status: 404 }
      );
    }
    if (
      tournament.status === "DRAW_IN_PROGRESS" ||
      tournament.status === "DRAW_COMPLETE"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot re-import teams once a draw has started",
        },
        { status: 422 }
      );
    }

    const body = await req.json();
    const rows: TeamCsvRow[] = Array.isArray(body.teams) ? body.teams : [];

    // --- Validation ---
    if (rows.length !== 16) {
      return NextResponse.json(
        {
          success: false,
          error: `Expected exactly 16 teams, got ${rows.length}`,
        },
        { status: 422 }
      );
    }

    const names = rows.map((r) =>
      typeof r.team_name === "string" ? r.team_name.trim() : ""
    );
    const emptyIdx = names.findIndex((n) => !n);
    if (emptyIdx !== -1) {
      return NextResponse.json(
        {
          success: false,
          error: `Row ${emptyIdx + 1} has an empty team_name`,
        },
        { status: 422 }
      );
    }

    const uniqueNames = new Set(names.map((n) => n.toLowerCase()));
    if (uniqueNames.size !== 16) {
      return NextResponse.json(
        { success: false, error: "Duplicate team names detected" },
        { status: 422 }
      );
    }

    // --- Atomic replace ---
    const teams = await tdPrisma.$transaction(async (tx: any) => {
      // Remove all existing (unassigned) teams
      await tx.tdTeam.deleteMany({ where: { tournamentId } });

      // Insert new batch
      const created = await Promise.all(
        rows.map((row, i) =>
          tx.tdTeam.create({
            data: {
              tournamentId,
              name: names[i],
              shortName: row.short_name?.trim() || null,
              country: row.country?.trim() || null,
              crestUrl: row.crest_url?.trim() || null,
              seedPot:
                row.seed_pot != null && row.seed_pot !== ""
                  ? Number(row.seed_pot)
                  : null,
              importedOrder: i,
            },
            include: { groupAssignment: true },
          })
        )
      );

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "TEAMS_READY" },
      });

      return created;
    });

    // biome-ignore lint/suspicious/noExplicitAny: generated runtime type
    return NextResponse.json({
      success: true,
      data: teams.map((t: any) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        groupAssignment: t.groupAssignment
          ? {
              ...t.groupAssignment,
              assignedAt: t.groupAssignment.assignedAt.toISOString(),
            }
          : null,
      })),
    });
  } catch (error) {
    logger.error("Failed to import teams", error);
    return NextResponse.json(
      { success: false, error: "Failed to import teams" },
      { status: 500 }
    );
  }
}
