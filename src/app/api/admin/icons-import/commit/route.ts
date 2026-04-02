import { type NextRequest, NextResponse } from "next/server";
import { analyzeIconsImportRows } from "@/features/icons-import/analysis";
import {
  consumeIconsImportCheckRecord,
  getIconsImportCheckRecord,
} from "@/features/icons-import/checkStore";
import { buildIconsImportCheckFingerprint } from "@/features/icons-import/fingerprint";
import {
  enqueueIconsImageIngestionRun,
  processIconsImageIngestionRun,
} from "@/features/icons-import/imageIngestion";
import { parsePointsValue } from "@/features/icons-import/normalize";
import { iconsImportWorkflowCommitPayloadSchema } from "@/features/icons-import/schema";
import type {
  IconsImportCommitResult,
  IconsImportMode,
  IconsImportResolutionAction,
} from "@/features/icons-import/types";
import { requireSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const parseResult = iconsImportWorkflowCommitPayloadSchema.safeParse(body);

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

    const { mode, checkId, checkFingerprint, rows, resolutions } =
      parseResult.data;

    const checkRecord = getIconsImportCheckRecord(checkId);
    if (!checkRecord) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Import check not found or expired. Please run Check with Database again.",
        },
        { status: 409 },
      );
    }

    if (checkRecord.mode !== mode) {
      return NextResponse.json(
        {
          success: false,
          error: "Import mode changed after check. Re-run Check with Database.",
        },
        { status: 409 },
      );
    }

    if (checkRecord.fingerprint !== checkFingerprint) {
      return NextResponse.json(
        {
          success: false,
          error: "Import data changed after check. Re-run Check with Database.",
        },
        { status: 409 },
      );
    }

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

    if (checkRecord.sessionId !== sessionId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Active session changed after check. Re-run Check with Database.",
        },
        { status: 409 },
      );
    }

    const recomputedFingerprint = buildIconsImportCheckFingerprint({
      sessionId,
      mode,
      headers: checkRecord.headers,
      rows,
    });

    if (recomputedFingerprint !== checkFingerprint) {
      return NextResponse.json(
        {
          success: false,
          error: "Import rows changed after check. Re-run Check with Database.",
        },
        { status: 409 },
      );
    }

    const { data: teams, error: teamsError } = await supabase
      .from("Team")
      .select("id,name,shortCode,pointsTotal,pointsSpent")
      .eq("sessionId", sessionId);

    if (teamsError) throw teamsError;

    const analysis = analyzeIconsImportRows({
      headers: checkRecord.headers,
      rows,
      teams: teams ?? [],
    });

    if (analysis.summary.missingHeaders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Required headers are missing. Fix CSV and run check again.",
          data: {
            missingHeaders: analysis.summary.missingHeaders,
          },
        },
        { status: 409 },
      );
    }

    const rowResultByKey = new Map(
      analysis.rows.map((rowResult) => [rowResult.rowKey, rowResult]),
    );

    const resolutionMap = new Map(
      resolutions.map((resolution) => [resolution.rowKey, resolution.action]),
    );

    const unresolved: string[] = [];
    let skippedCount = 0;
    const teamPointsByTeamId = new Map<string, number>();

    const upsertCandidates: Array<{
      row: (typeof rows)[number];
      teamId: string;
      role: NonNullable<(typeof analysis.rows)[number]["resolvedRole"]>;
    }> = [];

    const sortedRows = [...rows].sort((a, b) => a.importOrder - b.importOrder);

    for (const row of sortedRows) {
      const rowResult = rowResultByKey.get(row.rowKey);
      if (!rowResult) {
        unresolved.push(`Missing check result for row ${row.importOrder + 1}`);
        continue;
      }

      const action: IconsImportResolutionAction =
        resolutionMap.get(row.rowKey) ??
        (rowResult.resolutionRequired ? "SKIP" : "UPSERT");

      if (!rowResult.allowedActions.includes(action)) {
        unresolved.push(
          `Row ${row.importOrder + 1} uses unsupported action ${action}`,
        );
        continue;
      }

      if (action === "SKIP") {
        skippedCount += 1;
        continue;
      }

      if (!rowResult.teamMatch || !rowResult.resolvedRole) {
        unresolved.push(
          `Row ${row.importOrder + 1} could not resolve team and role for upsert`,
        );
        continue;
      }

      const parsedPoints = parsePointsValue(row.points);
      if (!parsedPoints.isValid) {
        unresolved.push(
          `Row ${row.importOrder + 1} has invalid POINTS value "${row.points ?? ""}"`,
        );
        continue;
      }

      if (parsedPoints.parsedPoints !== null) {
        const existingPoints = teamPointsByTeamId.get(rowResult.teamMatch.id);
        if (existingPoints === undefined) {
          teamPointsByTeamId.set(
            rowResult.teamMatch.id,
            parsedPoints.parsedPoints,
          );
        } else if (existingPoints !== parsedPoints.parsedPoints) {
          unresolved.push(
            `Row ${row.importOrder + 1} has POINTS ${parsedPoints.parsedPoints}, which conflicts with another row for team ${rowResult.teamMatch.name}`,
          );
          continue;
        }
      }

      upsertCandidates.push({
        row,
        teamId: rowResult.teamMatch.id,
        role: rowResult.resolvedRole,
      });
    }

    if (unresolved.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Unresolved import conflicts",
          data: {
            unresolvedCount: unresolved.length,
            issues: unresolved,
          },
        },
        { status: 409 },
      );
    }

    const uniqueTeamIds = [
      ...new Set(upsertCandidates.map((item) => item.teamId)),
    ];
    const teamById = new Map((teams ?? []).map((team) => [team.id, team]));

    const teamPointsUpdates: Array<{ teamId: string; pointsTotal: number }> =
      [];
    for (const [teamId, nextPointsTotal] of teamPointsByTeamId.entries()) {
      const team = teamById.get(teamId);
      if (!team) {
        unresolved.push(
          `Could not update points for team ${teamId} because it is no longer in the active session`,
        );
        continue;
      }

      if (nextPointsTotal < team.pointsSpent) {
        unresolved.push(
          `POINTS ${nextPointsTotal} cannot be applied to ${team.name} because the team has already spent ${team.pointsSpent}`,
        );
        continue;
      }

      if (nextPointsTotal !== team.pointsTotal) {
        teamPointsUpdates.push({
          teamId,
          pointsTotal: nextPointsTotal,
        });
      }
    }

    if (unresolved.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Unresolved import conflicts",
          data: {
            unresolvedCount: unresolved.length,
            issues: unresolved,
          },
        },
        { status: 409 },
      );
    }

    const sessionTeamIds = (teams ?? []).map((team) => team.id);

    let replacedProfilesCount = 0;
    if (mode === "REPLACE" && sessionTeamIds.length > 0) {
      const {
        data: existingSessionProfiles,
        error: existingSessionProfilesError,
      } = await supabase
        .from("TeamRoleProfile")
        .select("id")
        .in("teamId", sessionTeamIds);

      if (existingSessionProfilesError) throw existingSessionProfilesError;

      replacedProfilesCount = existingSessionProfiles?.length ?? 0;

      if (replacedProfilesCount > 0) {
        const { error: clearProfilesError } = await supabase
          .from("TeamRoleProfile")
          .delete()
          .in("teamId", sessionTeamIds);

        if (clearProfilesError) throw clearProfilesError;
      }
    }

    const { data: existingProfiles, error: existingProfilesError } =
      mode === "APPEND" && uniqueTeamIds.length > 0
        ? await supabase
            .from("TeamRoleProfile")
            .select("id,teamId,role,name,imageUrl")
            .in("teamId", uniqueTeamIds)
        : { data: [], error: null };

    if (existingProfilesError) throw existingProfilesError;

    const existingByTeamRole = new Map(
      (existingProfiles ?? []).map((profile) => [
        `${profile.teamId}::${profile.role}`,
        profile,
      ]),
    );

    const now = new Date().toISOString();

    const upserts = upsertCandidates.map((item) => {
      const key = `${item.teamId}::${item.role}`;
      const existing = existingByTeamRole.get(key);
      const nextName =
        item.row.name.trim() ||
        (mode === "APPEND" ? existing?.name : null) ||
        null;
      const nextImageUrl = item.row.imageUrl
        ? item.row.imageUrl
        : mode === "APPEND"
          ? existing?.imageUrl || null
          : null;

      return {
        id: existing?.id ?? crypto.randomUUID(),
        teamId: item.teamId,
        role: item.role,
        name: nextName,
        imageUrl: nextImageUrl,
        updatedAt: now,
      };
    });

    if (upserts.length > 0) {
      const { error: upsertError } = await supabase
        .from("TeamRoleProfile")
        .upsert(upserts, {
          onConflict: "teamId,role",
        });

      if (upsertError) throw upsertError;
    }

    for (const teamPointsUpdate of teamPointsUpdates) {
      const { error: updateTeamPointsError } = await supabase
        .from("Team")
        .update({ pointsTotal: teamPointsUpdate.pointsTotal })
        .eq("id", teamPointsUpdate.teamId)
        .eq("sessionId", sessionId);

      if (updateTeamPointsError) throw updateTeamPointsError;
    }

    const imageIngestionJobs = upsertCandidates
      .filter((item) => item.row.imageUrl)
      .map((item) => {
        const teamName = item.row.teamName.trim() || "Unknown team";
        const roleLabel = item.role === "CO_OWNER" ? "CO-OWNER" : item.role;
        const existing = existingByTeamRole.get(`${item.teamId}::${item.role}`);
        const fallbackName = `${teamName} ${roleLabel}`;

        return {
          rowKey: item.row.rowKey,
          rowNumber: item.row.importOrder + 1,
          name: item.row.name.trim() || existing?.name?.trim() || fallbackName,
          teamId: item.teamId,
          teamName,
          role: item.role,
          imageUrl: item.row.imageUrl as string,
        };
      });

    let imageIngestion = enqueueIconsImageIngestionRun(
      sessionId,
      imageIngestionJobs,
    );

    if (imageIngestion.runId !== "none") {
      const progressed = await processIconsImageIngestionRun(
        supabase,
        imageIngestion.runId,
        {
          maxJobs: 6,
          concurrency: 3,
        },
      );

      if (progressed) {
        imageIngestion = progressed;
      }
    }

    const result: IconsImportCommitResult = {
      mode: mode as IconsImportMode,
      sessionId,
      upsertedCount: upserts.length,
      skippedCount,
      teamsTouched: uniqueTeamIds.length,
      teamPointsUpdatedCount: teamPointsUpdates.length,
      replacedProfilesCount,
      imageIngestion,
    };

    consumeIconsImportCheckRecord(checkId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("Failed to commit icons import", error);
    return NextResponse.json(
      { success: false, error: "Failed to commit icons import" },
      { status: 500 },
    );
  }
}
