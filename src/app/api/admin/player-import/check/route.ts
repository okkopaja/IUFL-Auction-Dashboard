import { type NextRequest, NextResponse } from "next/server";
import { analyzeImportRows } from "@/features/player-import/analysis";
import { saveImportCheckRecord } from "@/features/player-import/checkStore";
import { buildImportCheckFingerprint } from "@/features/player-import/fingerprint";
import { loadIconNameSetForSession } from "@/features/player-import/iconLookup";
import { isIconName } from "@/features/player-import/iconNames";
import { importCheckPayloadSchema } from "@/features/player-import/schema";
import type {
  ImportCheckIssue,
  ImportCheckResult,
  ImportDbMatchSnapshot,
} from "@/features/player-import/types";
import { requireSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const parseResult = importCheckPayloadSchema.safeParse(body);

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

    const { data: players, error: playersError } = await supabase
      .from("Player")
      .select("id,name,whatsappNumber,status,teamId")
      .eq("sessionId", sessionId);

    if (playersError) throw playersError;

    const existingPlayers: ImportDbMatchSnapshot[] = (players ?? []).map(
      (player) => ({
        id: player.id,
        name: player.name,
        whatsappNumber: player.whatsappNumber,
        status: player.status,
        teamId: player.teamId,
      }),
    );

    const iconNameSet = await loadIconNameSetForSession(supabase, sessionId);
    const iconIssuesByRowKey = new Map<string, ImportCheckIssue[]>();

    for (const row of rows) {
      if (!isIconName(row.name, iconNameSet)) continue;

      iconIssuesByRowKey.set(row.rowKey, [
        {
          code: "ICON_PLAYER",
          severity: "blocking",
          field: "name",
          message:
            "Matches an IUFL icon name. Icons cannot be imported into the player base.",
        },
      ]);
    }

    const existingIconPlayersInBaseCount = existingPlayers.filter((player) =>
      isIconName(player.name, iconNameSet),
    ).length;

    const analysis = analyzeImportRows({
      mode,
      headers,
      rows,
      existingPlayers,
      extraIssuesByRowKey: iconIssuesByRowKey,
    });

    const checkId = crypto.randomUUID();
    const checkFingerprint = buildImportCheckFingerprint({
      sessionId,
      mode,
      headers,
      rows,
    });

    const result: ImportCheckResult = {
      mode,
      sessionId,
      checkId,
      checkFingerprint,
      checkedAt: new Date().toISOString(),
      rows: analysis.rows,
      summary: analysis.summary,
      hasBlockingIssues: analysis.hasBlockingIssues,
      existingIconPlayersInBaseCount,
    };

    saveImportCheckRecord({
      checkId,
      sessionId,
      mode,
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
    logger.error("Failed to run player import check", error);
    return NextResponse.json(
      { success: false, error: "Failed to check import data" },
      { status: 500 },
    );
  }
}
