import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  mapTeamRoleProfiles,
  TEAM_ROLE_FIELD_TO_DB_ROLE,
  type TeamRole,
} from "@/lib/teamRoles";

const normalizedTextSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const normalizedImageUrlSchema = normalizedTextSchema.superRefine(
  (value, ctx) => {
    if (!value) return;

    try {
      // Validate only when a URL is provided. Empty values clear the field.
      new URL(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid image URL",
      });
    }
  },
);

const teamRoleInputSchema = z.object({
  name: normalizedTextSchema,
  imageUrl: normalizedImageUrlSchema,
});

const updateTeamRolesPayloadSchema = z
  .object({
    owner: teamRoleInputSchema.optional(),
    coOwner: teamRoleInputSchema.optional(),
    captain: teamRoleInputSchema.optional(),
    marquee: teamRoleInputSchema.optional(),
  })
  .refine(
    (payload) =>
      payload.owner !== undefined ||
      payload.coOwner !== undefined ||
      payload.captain !== undefined ||
      payload.marquee !== undefined,
    { message: "At least one role update is required" },
  );

type UpdateTeamRolesPayload = z.infer<typeof updateTeamRolesPayloadSchema>;
type TeamRoleField = keyof typeof TEAM_ROLE_FIELD_TO_DB_ROLE;

function toRoleUpserts(teamId: string, payload: UpdateTeamRolesPayload) {
  const upserts: Array<{
    teamId: string;
    role: TeamRole;
    name: string | null;
    imageUrl: string | null;
    updatedAt: string;
  }> = [];
  const updatedAt = new Date().toISOString();

  for (const [field, role] of Object.entries(
    TEAM_ROLE_FIELD_TO_DB_ROLE,
  ) as Array<[TeamRoleField, TeamRole]>) {
    const value = payload[field];
    if (!value) continue;

    upserts.push({
      teamId,
      role,
      name: value.name,
      imageUrl: value.imageUrl,
      updatedAt,
    });
  }

  return upserts;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: teamId } = await params;
    const body = await req.json();

    const parseResult = updateTeamRolesPayloadSchema.safeParse(body);
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

    const upserts = toRoleUpserts(teamId, parseResult.data);
    if (upserts.length === 0) {
      return NextResponse.json(
        { success: false, error: "No role updates found" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdminClient();

    const { data: team, error: teamError } = await supabase
      .from("Team")
      .select("id")
      .eq("id", teamId)
      .maybeSingle();

    if (teamError) throw teamError;
    if (!team) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 },
      );
    }

    const { data: existingProfiles, error: existingProfilesError } =
      await supabase
        .from("TeamRoleProfile")
        .select("id,role")
        .eq("teamId", teamId);

    if (existingProfilesError) throw existingProfilesError;

    const idByRole = new Map(
      (existingProfiles ?? []).map((profile) => [profile.role, profile.id]),
    );

    const upsertsWithIds = upserts.map((entry) => ({
      ...entry,
      id: idByRole.get(entry.role) ?? crypto.randomUUID(),
    }));

    const { error: upsertError } = await supabase
      .from("TeamRoleProfile")
      .upsert(upsertsWithIds, {
        onConflict: "teamId,role",
      });

    if (upsertError) throw upsertError;

    const { data: roleProfiles, error: roleProfilesError } = await supabase
      .from("TeamRoleProfile")
      .select("*")
      .eq("teamId", teamId);

    if (roleProfilesError) throw roleProfilesError;

    return NextResponse.json({
      success: true,
      data: {
        ...mapTeamRoleProfiles(roleProfiles ?? []),
        roleProfiles: roleProfiles ?? [],
      },
    });
  } catch (error) {
    logger.error("Failed to update team role profiles", error);
    return NextResponse.json(
      { success: false, error: "Failed to update team role profiles" },
      { status: 500 },
    );
  }
}
