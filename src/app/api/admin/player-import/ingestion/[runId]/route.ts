import { type NextRequest, NextResponse } from "next/server";
import {
  processImageIngestionRun,
  syncImageIngestionRun,
} from "@/features/player-import/imageIngestion";
import { requireSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const { runId } = await params;
    const processParam = req.nextUrl.searchParams.get("process") ?? "1";
    const shouldProcess = processParam !== "0";

    const supabase = getSupabaseAdminClient();

    const progress = shouldProcess
      ? await processImageIngestionRun(supabase, runId, {
          maxJobs: 6,
          concurrency: 3,
        })
      : await syncImageIngestionRun(supabase, runId);

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
    logger.error("Failed to fetch image ingestion progress", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch ingestion progress" },
      { status: 500 },
    );
  }
}
