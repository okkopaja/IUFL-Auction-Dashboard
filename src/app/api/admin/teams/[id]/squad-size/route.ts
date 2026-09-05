import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { AUCTION_FIXED_ROLE_SLOTS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

const updateTeamSquadSizePayloadSchema = z.object({
  squadSize: z.coerce
    .number()
    .int()
    .min(
      AUCTION_FIXED_ROLE_SLOTS + 1,
      `Squad size must be at least ${AUCTION_FIXED_ROLE_SLOTS + 1}`,
    )
    .max(100, "Squad size must be 100 or less"),
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
    const parseResult = updateTeamSquadSizePayloadSchema.safeParse(body);

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

    const { squadSize } = parseResult.data;
    const supabase = getSupabaseAdminClient();
    const { data: session, error: sessionError } = await supabase
      .from("AuctionSession")
      .select("id")
      .eq("isActive", true)
      .limit(1)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No active auction session found" },
        { status: 404 },
      );
    }

    const { data: team, error: teamError } = await supabase
      .from("Team")
      .select("id,squadSize")
      .eq("id", teamId)
      .eq("sessionId", session.id)
      .maybeSingle();

    if (teamError) throw teamError;
    if (!team) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 },
      );
    }

    const { count: playersOwnedCount, error: playersError } = await supabase
      .from("Player")
      .select("id", { count: "exact", head: true })
      .eq("sessionId", session.id)
      .eq("teamId", team.id);

    if (playersError) throw playersError;

    const { data: roles, error: rolesError } = await supabase
      .from("TeamRoleProfile")
      .select("role,name,imageUrl")
      .eq("teamId", team.id)
      .in("role", ["CAPTAIN", "MARQUEE"]);

    if (rolesError) throw rolesError;

    const configuredFixedRoles = (roles ?? []).filter((role) =>
      Boolean(role.name?.trim() || role.imageUrl?.trim()),
    ).length;
    const currentSquadSize = (playersOwnedCount ?? 0) + configuredFixedRoles;

    if (squadSize < currentSquadSize) {
      return NextResponse.json(
        {
          success: false,
          error: `Squad size cannot be below the current squad count (${currentSquadSize})`,
        },
        { status: 409 },
      );
    }

    const { data: updatedTeam, error: updateError } = await supabase
      .from("Team")
      .update({ squadSize })
      .eq("id", team.id)
      .eq("sessionId", session.id)
      .select("id,squadSize")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedTeam) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: updatedTeam });
  } catch (error) {
    logger.error("Failed to update team squad size", error);
    return NextResponse.json(
      { success: false, error: "Failed to update team squad size" },
      { status: 500 },
    );
  }
}
