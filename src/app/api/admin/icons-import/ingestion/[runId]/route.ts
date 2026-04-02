import { type NextRequest, NextResponse } from "next/server";
import {
  processIconsImageIngestionRun,
  syncIconsImageIngestionRun,
} from "@/features/icons-import/imageIngestion";
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
    const shouldProcess = req.nextUrl.searchParams.get("process") === "1";

    const progress = shouldProcess
      ? await processIconsImageIngestionRun(getSupabaseAdminClient(), runId, {
          maxJobs: 6,
          concurrency: 3,
        })
      : syncIconsImageIngestionRun(runId);

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
    logger.error("Failed to fetch icons image ingestion progress", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch ingestion progress" },
      { status: 500 },
    );
  }
}
