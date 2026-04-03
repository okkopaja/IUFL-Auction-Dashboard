import { type NextRequest, NextResponse } from "next/server";
import { analyzeImportRows } from "@/features/player-import/analysis";
import {
  consumeImportCheckRecord,
  getImportCheckRecord,
} from "@/features/player-import/checkStore";
import { buildImportCheckFingerprint } from "@/features/player-import/fingerprint";
import { loadIconNameSetForSession } from "@/features/player-import/iconLookup";
import {
  filterRowsByIconName,
  isIconName,
} from "@/features/player-import/iconNames";
import {
  enqueueDriveImageIngestionRun,
  processImageIngestionRun,
} from "@/features/player-import/imageIngestion";
import { importWorkflowCommitPayloadSchema } from "@/features/player-import/schema";
import type {
  ImportCheckIssue,
  ImportCommitResult,
  ImportDbMatchSnapshot,
  ImportResolutionAction,
} from "@/features/player-import/types";
import { requireSuperAdmin } from "@/lib/auth";
import { PLAYER_BASE_PRICE } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

interface ExistingPlayerRow extends ImportDbMatchSnapshot {
  importOrder: number;
}

export async function POST(req: NextRequest) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const parseResult = importWorkflowCommitPayloadSchema.safeParse(body);

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

    const checkRecord = getImportCheckRecord(checkId);
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

    const hasSecondaryPositionColumn = checkRecord.headers.some(
      (header) =>
        header === "Secondary Position" || header === "Secondary Postion",
    );
    const hasWhatsappNumberColumn =
      checkRecord.headers.includes("Whatsapp Number");
    const hasImageUrlColumn = checkRecord.headers.includes("Image URL");

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

    const recomputedFingerprint = buildImportCheckFingerprint({
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

    const [{ data: players, error: playersError }, { count: existingTxCount }] =
      await Promise.all([
        supabase
          .from("Player")
          .select("id,name,whatsappNumber,status,teamId,importOrder")
          .eq("sessionId", sessionId),
        supabase
          .from("Transaction")
          .select("id", { count: "exact", head: true })
          .eq("sessionId", sessionId),
      ]);

    if (playersError) throw playersError;

    const existingPlayers: ExistingPlayerRow[] = (players ?? []).map(
      (player) => ({
        id: player.id,
        name: player.name,
        whatsappNumber: player.whatsappNumber,
        status: player.status,
        teamId: player.teamId,
        importOrder: player.importOrder ?? 0,
      }),
    );

    const iconNameSet = await loadIconNameSetForSession(supabase, sessionId);

    const existingIconPlayersInBase = filterRowsByIconName(
      existingPlayers,
      iconNameSet,
    );
    if (existingIconPlayersInBase.length > 0) {
      const iconPlayersPreview = [
        ...new Set(
          existingIconPlayersInBase.map((player) => player.name.trim()),
        ),
      ].slice(0, 8);

      return NextResponse.json(
        {
          success: false,
          error:
            "IUFL icons are present in the player base. Use Remove IUFL Icons from Playerbase before committing import.",
          data: {
            iconPlayersInBaseCount: existingIconPlayersInBase.length,
            iconPlayersPreview,
          },
        },
        { status: 409 },
      );
    }

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

    const analysis = analyzeImportRows({
      mode,
      headers: checkRecord.headers,
      rows,
      existingPlayers,
      extraIssuesByRowKey: iconIssuesByRowKey,
    });

    if (analysis.summary.missingHeaders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Required headers are missing. Fix CSV headers and run Check with Database again.",
          data: {
            missingHeaders: analysis.summary.missingHeaders,
            unresolvedCount: analysis.summary.missingHeaders.length,
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
    const plannedInserts = [] as typeof rows;
    const plannedUpdates: Array<{
      playerId: string;
      row: (typeof rows)[number];
    }> = [];
    const seenInsertKeys = new Set<string>();
    const seenUpdateIds = new Set<string>();
    let skippedCount = 0;

    const sortedRows = [...rows].sort((a, b) => a.importOrder - b.importOrder);

    for (const row of sortedRows) {
      const rowResult = rowResultByKey.get(row.rowKey);
      if (!rowResult) {
        unresolved.push(`Missing check result for row ${row.importOrder + 1}`);
        continue;
      }

      const action: ImportResolutionAction =
        resolutionMap.get(row.rowKey) ??
        (rowResult.resolutionRequired ? rowResult.suggestedAction : "INSERT");

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

      if (action === "UPDATE") {
        if (!rowResult.dbMatch) {
          unresolved.push(`Row ${row.importOrder + 1} has no DB row to update`);
          continue;
        }

        if (seenUpdateIds.has(rowResult.dbMatch.id)) {
          unresolved.push(
            `Row ${row.importOrder + 1} targets the same DB player multiple times`,
          );
          continue;
        }

        seenUpdateIds.add(rowResult.dbMatch.id);
        plannedUpdates.push({ playerId: rowResult.dbMatch.id, row });
        continue;
      }

      if (seenInsertKeys.has(rowResult.normalizedKey)) {
        unresolved.push(
          `Row ${row.importOrder + 1} would create a duplicate insert key`,
        );
        continue;
      }

      if (mode === "APPEND" && rowResult.dbMatch) {
        unresolved.push(
          `Row ${row.importOrder + 1} matches an existing DB player and cannot be inserted`,
        );
        continue;
      }

      seenInsertKeys.add(rowResult.normalizedKey);
      plannedInserts.push(row);
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

    let removedPlayersCount = 0;
    let removedTransactionsCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    const imageAssignments: Array<{
      playerId: string;
      imageUrl: string | null;
    }> = [];

    const now = new Date().toISOString();

    if (mode === "REPLACE") {
      removedPlayersCount = existingPlayers.length;
      removedTransactionsCount = existingTxCount ?? 0;

      const { error: deleteTxError } = await supabase
        .from("Transaction")
        .delete()
        .eq("sessionId", sessionId);
      if (deleteTxError) throw deleteTxError;

      const { error: resetTeamsError } = await supabase
        .from("Team")
        .update({ pointsSpent: 0 })
        .eq("sessionId", sessionId);
      if (resetTeamsError) throw resetTeamsError;

      // Remove ingestion artifacts referencing old players before deleting players.
      const { error: deleteImageJobsError } = await supabase
        .from("ImportImageIngestionJob")
        .delete()
        .eq("sessionId", sessionId);
      if (deleteImageJobsError) throw deleteImageJobsError;

      const { error: deleteImageRunsError } = await supabase
        .from("ImportImageIngestionRun")
        .delete()
        .eq("sessionId", sessionId);
      if (deleteImageRunsError) throw deleteImageRunsError;

      const { error: deletePlayersError } = await supabase
        .from("Player")
        .delete()
        .eq("sessionId", sessionId);
      if (deletePlayersError) throw deletePlayersError;

      const inserts = plannedInserts.map((row, idx) => ({
        id: crypto.randomUUID(),
        sessionId,
        name: row.name,
        year: row.year,
        whatsappNumber: row.whatsappNumber,
        stream: row.stream,
        position1: row.position1,
        position2: row.position2 ?? null,
        importOrder: idx,
        status: "UNSOLD" as const,
        teamId: null,
        imageUrl: null,
        basePrice: PLAYER_BASE_PRICE,
        createdAt: now,
        updatedAt: now,
      }));

      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from("Player")
          .insert(inserts);
        if (insertError) throw insertError;

        if (hasImageUrlColumn) {
          for (const [idx, insert] of inserts.entries()) {
            imageAssignments.push({
              playerId: insert.id,
              imageUrl: plannedInserts[idx]?.imageUrl ?? null,
            });
          }
        }
      }

      insertedCount = inserts.length;
    } else {
      const maxImportOrder = existingPlayers.reduce(
        (max, player) => Math.max(max, player.importOrder),
        -1,
      );

      if (plannedUpdates.length > 0) {
        const updateOps = plannedUpdates.map(({ playerId, row }) => {
          const updateData: {
            name: string;
            year: string;
            stream: string;
            position1: string;
            basePrice: number;
            updatedAt: string;
            whatsappNumber?: string | null;
            position2?: string | null;
            imageUrl?: string | null;
          } = {
            name: row.name,
            year: row.year,
            stream: row.stream,
            position1: row.position1,
            basePrice: PLAYER_BASE_PRICE,
            updatedAt: now,
          };

          if (hasWhatsappNumberColumn) {
            updateData.whatsappNumber = row.whatsappNumber ?? null;
          }

          if (hasSecondaryPositionColumn) {
            updateData.position2 = row.position2 ?? null;
          }

          if (hasImageUrlColumn) {
            updateData.imageUrl = null;
          }

          return supabase
            .from("Player")
            .update(updateData)
            .eq("id", playerId)
            .eq("sessionId", sessionId);
        });

        const updateResults = await Promise.all(updateOps);
        const failedUpdate = updateResults.find((result) => result.error);
        if (failedUpdate?.error) throw failedUpdate.error;

        if (hasImageUrlColumn) {
          for (const planned of plannedUpdates) {
            imageAssignments.push({
              playerId: planned.playerId,
              imageUrl: planned.row.imageUrl ?? null,
            });
          }
        }
      }

      updatedCount = plannedUpdates.length;

      const inserts = plannedInserts.map((row, idx) => ({
        id: crypto.randomUUID(),
        sessionId,
        name: row.name,
        year: row.year,
        whatsappNumber: row.whatsappNumber,
        stream: row.stream,
        position1: row.position1,
        position2: row.position2 ?? null,
        importOrder: maxImportOrder + idx + 1,
        status: "UNSOLD" as const,
        teamId: null,
        imageUrl: null,
        basePrice: PLAYER_BASE_PRICE,
        createdAt: now,
        updatedAt: now,
      }));

      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from("Player")
          .insert(inserts);
        if (insertError) throw insertError;

        if (hasImageUrlColumn) {
          for (const [idx, insert] of inserts.entries()) {
            imageAssignments.push({
              playerId: insert.id,
              imageUrl: plannedInserts[idx]?.imageUrl ?? null,
            });
          }
        }
      }

      insertedCount = inserts.length;
    }

    let imageIngestion: ImportCommitResult["imageIngestion"] = null;

    if (hasImageUrlColumn && imageAssignments.length > 0) {
      imageIngestion = await enqueueDriveImageIngestionRun(
        supabase,
        sessionId,
        imageAssignments,
      );

      if (imageIngestion) {
        const progressed = await processImageIngestionRun(
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
    }

    consumeImportCheckRecord(checkId);

    const result: ImportCommitResult = {
      mode,
      insertedCount,
      updatedCount,
      skippedCount,
      unresolvedCount: 0,
      importedCount: insertedCount + updatedCount,
      removedPlayersCount,
      removedTransactionsCount,
      sessionId,
      imageIngestion,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error("Failed to commit player import", error);
    return NextResponse.json(
      { success: false, error: "Failed to commit import" },
      { status: 500 },
    );
  }
}
