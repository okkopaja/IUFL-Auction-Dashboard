import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { tdPrisma } from "@/lib/teams-dist/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/teams-dist/tournaments/[id]/export?format=csv|json
 *
 * Exports all group assignments for the tournament.
 */
export async function GET(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: tournamentId } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "csv";

    const assignments = await tdPrisma.tdGroupAssignment.findMany({
      where: { tournamentId },
      include: { team: true, action: true },
      orderBy: [{ groupName: "asc" }, { slotIndex: "asc" }],
    });

    if (format === "json") {
      // biome-ignore lint/suspicious/noExplicitAny: generated runtime type
      const data = assignments.map((a: any) => ({
        team_name: a.team.name,
        short_name: a.team.shortName,
        country: a.team.country,
        crest_url: a.team.crestUrl,
        group_name: a.groupName,
        slot_index: a.slotIndex,
        draw_mode: a.drawMode,
        draw_order: a.slotIndex,
        assigned_at: a.assignedAt.toISOString(),
      }));

      return NextResponse.json(
        { success: true, data },
        {
          headers: {
            "Content-Disposition": `attachment; filename="group-assignments-${tournamentId}.json"`,
          },
        }
      );
    }

    // CSV
    const header =
      "team_name,short_name,country,group_name,draw_mode,draw_order,assigned_at";
    // biome-ignore lint/suspicious/noExplicitAny: generated runtime type
    const rows = assignments.map((a: any) =>
      [
        JSON.stringify(a.team.name),
        JSON.stringify(a.team.shortName ?? ""),
        JSON.stringify(a.team.country ?? ""),
        a.groupName,
        a.drawMode,
        a.slotIndex,
        a.assignedAt.toISOString(),
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="group-assignments-${tournamentId}.csv"`,
      },
    });
  } catch (error) {
    logger.error("Failed to export assignments", error);
    return NextResponse.json(
      { success: false, error: "Failed to export assignments" },
      { status: 500 }
    );
  }
}
