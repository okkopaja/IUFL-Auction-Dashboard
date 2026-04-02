import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processImageIngestionRun } from "@/features/player-import/imageIngestion";
import { requireSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

const processRunPayloadSchema = z.object({
  runId: z.string().min(1, "runId is required"),
  maxJobs: z.number().int().min(1).max(100).optional(),
  concurrency: z.number().int().min(1).max(5).optional(),
});

export async function POST(req: NextRequest) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const parseResult = processRunPayloadSchema.safeParse(body);

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

    const supabase = getSupabaseAdminClient();

    const progress = await processImageIngestionRun(
      supabase,
      parseResult.data.runId,
      {
        maxJobs: parseResult.data.maxJobs,
        concurrency: parseResult.data.concurrency,
      },
    );

    if (!progress) {
      return NextResponse.json(
        { success: false, error: "Ingestion run not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error("Failed to process image ingestion run", error);
    return NextResponse.json(
      { success: false, error: "Failed to process ingestion run" },
      { status: 500 },
    );
  }
}
