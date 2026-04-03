import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

const updateTeamPointsPayloadSchema = z.object({
  pointsTotal: z.coerce
    .number()
    .int()
    .min(0, "Points must be a non-negative whole number"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: teamId } = await params;
    const body = await req.json();
    const parseResult = updateTeamPointsPayloadSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { pointsTotal } = parseResult.data;
    const supabase = getSupabaseAdminClient();

    const { data: team, error: teamError } = await supabase
      .from("Team")
      .select("id,pointsTotal,pointsSpent")
      .eq("id", teamId)
      .maybeSingle();

    if (teamError) throw teamError;

    if (!team) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 },
      );
    }

    if (pointsTotal < team.pointsSpent) {
      return NextResponse.json(
        {
          success: false,
          error: `Points total cannot be below points spent (${team.pointsSpent})`,
        },
        { status: 409 },
      );
    }

    if (pointsTotal === team.pointsTotal) {
      return NextResponse.json({
        success: true,
        data: {
          id: team.id,
          pointsTotal: team.pointsTotal,
          pointsSpent: team.pointsSpent,
          pointsRemaining: team.pointsTotal - team.pointsSpent,
        },
      });
    }

    const { data: updatedTeam, error: updateError } = await supabase
      .from("Team")
      .update({ pointsTotal })
      .eq("id", teamId)
      .select("id,pointsTotal,pointsSpent")
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updatedTeam) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedTeam.id,
        pointsTotal: updatedTeam.pointsTotal,
        pointsSpent: updatedTeam.pointsSpent,
        pointsRemaining: updatedTeam.pointsTotal - updatedTeam.pointsSpent,
      },
    });
  } catch (error) {
    logger.error("Failed to update team points", error);
    return NextResponse.json(
      { success: false, error: "Failed to update team points" },
      { status: 500 },
    );
  }
}
