import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

const requiredNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(120, "Name is too long");

const requiredPositionSchema = z
  .string()
  .trim()
  .min(1, "Primary position is required")
  .max(60, "Primary position is too long");

const normalizedOptionalTextSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const normalizedPosition2Schema = normalizedOptionalTextSchema.superRefine(
  (value, ctx) => {
    if (!value) return;
    if (value.length > 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Secondary position is too long",
      });
    }
  },
);

const normalizedImageUrlSchema = normalizedOptionalTextSchema.superRefine(
  (value, ctx) => {
    if (!value) return;

    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Unsupported URL protocol");
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid image URL",
      });
    }
  },
);

const updatePlayerPayloadSchema = z.object({
  name: requiredNameSchema,
  position1: requiredPositionSchema,
  position2: normalizedPosition2Schema.optional(),
  imageUrl: normalizedImageUrlSchema.optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: playerId } = await params;
    const body = await req.json();
    const parseResult = updatePlayerPayloadSchema.safeParse(body);

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

    const now = new Date().toISOString();
    const supabase = getSupabaseAdminClient();

    const { data: updatedPlayer, error: updateError } = await supabase
      .from("Player")
      .update({
        name: parseResult.data.name,
        position1: parseResult.data.position1,
        position2: parseResult.data.position2 ?? null,
        imageUrl: parseResult.data.imageUrl ?? null,
        updatedAt: now,
      })
      .eq("id", playerId)
      .select("id,name,position1,position2,imageUrl,updatedAt")
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updatedPlayer) {
      return NextResponse.json(
        { success: false, error: "Player not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedPlayer,
    });
  } catch (error) {
    logger.error("Failed to update player", error);
    return NextResponse.json(
      { success: false, error: "Failed to update player" },
      { status: 500 },
    );
  }
}
