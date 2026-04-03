import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { resolveImageType } from "@/lib/imageType";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

const PLAYER_IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const PLAYER_IMAGES_BUCKET =
  process.env.PLAYER_IMAGES_BUCKET?.trim() || "player-images";

function buildStoragePath(
  sessionId: string,
  playerId: string,
  extension: string,
): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");

  return [
    "players",
    "manual",
    sessionId,
    playerId,
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
    const { id: playerId } = await params;
    const formData = await req.formData();

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

    if (file.size > PLAYER_IMAGE_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Image exceeds ${(PLAYER_IMAGE_UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(0)}MB limit`,
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

    const { data: player, error: playerError } = await supabase
      .from("Player")
      .select("id,sessionId")
      .eq("id", playerId)
      .maybeSingle();

    if (playerError) throw playerError;
    if (!player) {
      return NextResponse.json(
        { success: false, error: "Player not found" },
        { status: 404 },
      );
    }

    const storagePath = buildStoragePath(
      player.sessionId,
      player.id,
      imageType.extension,
    );

    const { error: uploadError } = await supabase.storage
      .from(PLAYER_IMAGES_BUCKET)
      .upload(storagePath, bytes, {
        upsert: false,
        cacheControl: "31536000",
        contentType: imageType.contentType,
      });

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    const imageUrl = supabase.storage
      .from(PLAYER_IMAGES_BUCKET)
      .getPublicUrl(storagePath).data.publicUrl;

    if (!imageUrl) {
      throw new Error("Failed to generate public URL");
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl,
      },
    });
  } catch (error) {
    logger.error("Failed to upload player image", error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to upload image: ${getSafeErrorMessage(error)}`,
      },
      { status: 500 },
    );
  }
}
