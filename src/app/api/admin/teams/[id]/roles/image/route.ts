import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { resolveImageType } from "@/lib/imageType";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { TEAM_ROLE_FIELD_TO_DB_ROLE } from "@/lib/teamRoles";

const TEAM_ROLE_IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const TEAM_ROLE_IMAGES_BUCKET =
  process.env.ICON_IMAGES_BUCKET?.trim() || "icon-images";

const roleFieldSchema = z.enum(["owner", "coOwner", "captain", "marquee"]);
type TeamRoleField = z.infer<typeof roleFieldSchema>;

function buildStoragePath(
  teamId: string,
  roleField: TeamRoleField,
  extension: string,
) {
  const dbRole = TEAM_ROLE_FIELD_TO_DB_ROLE[roleField].toLowerCase();
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");

  return [
    "team-role-icons",
    "manual",
    teamId,
    dbRole,
    String(now.getUTCFullYear()),
    month,
    day,
    `${randomUUID()}.${extension}`,
  ].join("/");
}

function getSafeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: teamId } = await params;
    const formData = await req.formData();

    const roleValue = formData.get("role");
    if (typeof roleValue !== "string") {
      return NextResponse.json(
        { success: false, error: "Role is required" },
        { status: 400 },
      );
    }

    const parsedRole = roleFieldSchema.safeParse(roleValue);
    if (!parsedRole.success) {
      return NextResponse.json(
        { success: false, error: "Invalid role" },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Image file is required" },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: "Image file is empty" },
        { status: 400 },
      );
    }

    if (file.size > TEAM_ROLE_IMAGE_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Image exceeds ${(TEAM_ROLE_IMAGE_UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(0)}MB limit`,
        },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const imageType = resolveImageType(file.type, bytes);
    if (!imageType) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unsupported image format. Use JPG, PNG, WEBP, GIF, AVIF, or SVG.",
        },
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

    const storagePath = buildStoragePath(
      teamId,
      parsedRole.data,
      imageType.extension,
    );

    const { error: uploadError } = await supabase.storage
      .from(TEAM_ROLE_IMAGES_BUCKET)
      .upload(storagePath, bytes, {
        upsert: false,
        cacheControl: "31536000",
        contentType: imageType.contentType,
      });

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    const imageUrl = supabase.storage
      .from(TEAM_ROLE_IMAGES_BUCKET)
      .getPublicUrl(storagePath).data.publicUrl;

    if (!imageUrl) {
      throw new Error("Failed to generate public URL");
    }

    return NextResponse.json({
      success: true,
      data: {
        role: parsedRole.data,
        imageUrl,
      },
    });
  } catch (error) {
    logger.error("Failed to upload team role image", error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to upload image: ${getSafeErrorMessage(error)}`,
      },
      { status: 500 },
    );
  }
}
