import { type NextRequest, NextResponse } from "next/server";
import { analyzeIconsImportRows } from "@/features/icons-import/analysis";
import { saveIconsImportCheckRecord } from "@/features/icons-import/checkStore";
import { buildIconsImportCheckFingerprint } from "@/features/icons-import/fingerprint";
import { iconsImportCheckPayloadSchema } from "@/features/icons-import/schema";
import type { IconsImportCheckResult } from "@/features/icons-import/types";
import { requireSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const parseResult = iconsImportCheckPayloadSchema.safeParse(body);

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

    const { mode, headers, rows } = parseResult.data;
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

    const sessionId = session.id;

    const { data: teams, error: teamsError } = await supabase
      .from("Team")
      .select("id,name,shortCode")
      .eq("sessionId", sessionId);

    if (teamsError) throw teamsError;

    const analysis = analyzeIconsImportRows({
      headers,
      rows,
      teams: teams ?? [],
    });

    const checkId = crypto.randomUUID();
    const checkFingerprint = buildIconsImportCheckFingerprint({
      sessionId,
      mode,
      headers,
      rows,
    });

    const result: IconsImportCheckResult = {
      mode,
      sessionId,
      checkId,
      checkFingerprint,
      checkedAt: new Date().toISOString(),
      rows: analysis.rows,
      summary: analysis.summary,
      hasBlockingIssues: analysis.hasBlockingIssues,
    };

    saveIconsImportCheckRecord({
      checkId,
      mode,
      sessionId,
      headers,
      rows,
      fingerprint: checkFingerprint,
      result,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("Failed to run icons import check", error);
    return NextResponse.json(
      { success: false, error: "Failed to check icons import data" },
      { status: 500 },
    );
  }
}
