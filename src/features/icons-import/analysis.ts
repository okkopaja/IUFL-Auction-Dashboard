import type { TeamRole } from "@/types";
import { REQUIRED_HEADERS } from "./constants";
import {
  buildTeamRoleIdentityKey,
  normalizeTeamKey,
  parsePointsValue,
  parseStatusToRole,
} from "./normalize";
import type {
  IconsImportCheckResult,
  IconsImportCheckRowResult,
  IconsImportCheckSummary,
  IconsImportCommitRow,
  IconsImportIssue,
  IconsImportResolutionAction,
  IconsImportTeamLookupRow,
} from "./types";

interface AnalyzeIconsImportRowsInput {
  headers: string[];
  rows: IconsImportCommitRow[];
  teams: IconsImportTeamLookupRow[];
}

interface TeamLookup {
  byKey: Map<string, IconsImportTeamLookupRow[]>;
}

function makeIssue(
  issue: Omit<IconsImportIssue, "severity"> & {
    severity?: IconsImportIssue["severity"];
  },
): IconsImportIssue {
  return {
    severity: issue.severity ?? "blocking",
    ...issue,
  };
}

function buildTeamLookup(teams: IconsImportTeamLookupRow[]): TeamLookup {
  const byKey = new Map<string, IconsImportTeamLookupRow[]>();

  for (const team of teams) {
    const keys = new Set([
      normalizeTeamKey(team.name),
      normalizeTeamKey(team.shortCode),
    ]);

    for (const key of keys) {
      const existing = byKey.get(key) ?? [];
      existing.push(team);
      byKey.set(key, existing);
    }
  }

  return { byKey };
}

function resolveTeam(
  teamName: string,
  lookup: TeamLookup,
): { team: IconsImportTeamLookupRow | null; ambiguous: boolean } {
  const key = normalizeTeamKey(teamName);
  const matches = lookup.byKey.get(key) ?? [];
  if (matches.length === 0) return { team: null, ambiguous: false };
  if (matches.length > 1) return { team: null, ambiguous: true };
  return { team: matches[0] ?? null, ambiguous: false };
}

function defaultResolutionForRow(blockingIssueCount: number): {
  resolutionRequired: boolean;
  allowedActions: IconsImportResolutionAction[];
  suggestedAction: IconsImportResolutionAction;
} {
  if (blockingIssueCount > 0) {
    return {
      resolutionRequired: true,
      allowedActions: ["SKIP"],
      suggestedAction: "SKIP",
    };
  }

  return {
    resolutionRequired: false,
    allowedActions: ["UPSERT", "SKIP"],
    suggestedAction: "UPSERT",
  };
}

function isValidImageUrl(imageUrl: string): boolean {
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function analyzeIconsImportRows({
  headers,
  rows,
  teams,
}: AnalyzeIconsImportRowsInput): Pick<
  IconsImportCheckResult,
  "rows" | "summary" | "hasBlockingIssues"
> {
  const missingHeaders = REQUIRED_HEADERS.filter(
    (requiredHeader) => !headers.includes(requiredHeader),
  );
  const teamLookup = buildTeamLookup(teams);
  const firstRowByTeamRole = new Map<
    string,
    { rowKey: string; rowNumber: number }
  >();
  const firstPointsByTeam = new Map<
    string,
    { points: number; rowKey: string; rowNumber: number }
  >();

  const analyzedRows: IconsImportCheckRowResult[] = rows.map((row) => {
    const issues: IconsImportIssue[] = [];

    if (!row.name.trim()) {
      issues.push(
        makeIssue({
          code: "MISSING_REQUIRED_FIELD",
          field: "name",
          message: "NAME is required",
        }),
      );
    }

    if (!row.teamName.trim()) {
      issues.push(
        makeIssue({
          code: "MISSING_REQUIRED_FIELD",
          field: "teamName",
          message: "TEAM NAME is required",
        }),
      );
    }

    if (!row.status.trim()) {
      issues.push(
        makeIssue({
          code: "MISSING_REQUIRED_FIELD",
          field: "status",
          message: "STATUS is required",
        }),
      );
    }

    const resolvedRole: TeamRole | null = row.status.trim()
      ? parseStatusToRole(row.status)
      : null;

    if (!resolvedRole && row.status.trim()) {
      issues.push(
        makeIssue({
          code: "INVALID_ROLE",
          field: "status",
          message: "STATUS must be one of OWNER, CO-OWNER, CAPTAIN, or MARQUEE",
        }),
      );
    }

    const resolved = resolveTeam(row.teamName, teamLookup);
    if (!resolved.team && row.teamName.trim()) {
      issues.push(
        makeIssue({
          code: resolved.ambiguous ? "AMBIGUOUS_TEAM" : "UNKNOWN_TEAM",
          field: "teamName",
          message: resolved.ambiguous
            ? `TEAM NAME "${row.teamName}" matches multiple teams`
            : `TEAM NAME "${row.teamName}" does not match any team`,
        }),
      );
    }

    if (row.imageUrl && !isValidImageUrl(row.imageUrl)) {
      issues.push(
        makeIssue({
          code: "INVALID_IMAGE_URL",
          field: "imageUrl",
          message: "IMAGE URL must be a valid http(s) URL",
        }),
      );
    }

    const parsedPoints = parsePointsValue(row.points);
    if (!parsedPoints.isValid) {
      issues.push(
        makeIssue({
          code: "INVALID_POINTS",
          field: "points",
          message: "POINTS must be a whole number (for example 2900)",
        }),
      );
    }

    if (resolved.team && parsedPoints.parsedPoints !== null) {
      const firstPoints = firstPointsByTeam.get(resolved.team.id);
      if (!firstPoints) {
        firstPointsByTeam.set(resolved.team.id, {
          points: parsedPoints.parsedPoints,
          rowKey: row.rowKey,
          rowNumber: row.importOrder + 1,
        });
      } else if (firstPoints.points !== parsedPoints.parsedPoints) {
        issues.push(
          makeIssue({
            code: "TEAM_POINTS_CONFLICT",
            field: "points",
            message: `POINTS conflicts with row ${firstPoints.rowNumber} for this team (${firstPoints.points} vs ${parsedPoints.parsedPoints})`,
            relatedRowKey: firstPoints.rowKey,
            relatedRowNumber: firstPoints.rowNumber,
          }),
        );
      }
    }

    const identityKey = buildTeamRoleIdentityKey(
      row.teamName,
      resolvedRole,
      row.status,
    );

    const first = firstRowByTeamRole.get(identityKey);
    if (!first) {
      firstRowByTeamRole.set(identityKey, {
        rowKey: row.rowKey,
        rowNumber: row.importOrder + 1,
      });
    } else {
      issues.push(
        makeIssue({
          code: "CSV_DUPLICATE_TEAM_ROLE",
          message: `Duplicate team-role row of row ${first.rowNumber}`,
          relatedRowKey: first.rowKey,
          relatedRowNumber: first.rowNumber,
        }),
      );
    }

    const blockingIssueCount = issues.filter(
      (issue) => issue.severity === "blocking",
    ).length;
    const warningIssueCount = issues.filter(
      (issue) => issue.severity === "warning",
    ).length;

    const resolution = defaultResolutionForRow(blockingIssueCount);

    return {
      rowKey: row.rowKey,
      importOrder: row.importOrder,
      normalizedTeamRoleKey: identityKey,
      issues,
      blockingIssueCount,
      warningIssueCount,
      resolutionRequired: resolution.resolutionRequired,
      allowedActions: resolution.allowedActions,
      suggestedAction: resolution.suggestedAction,
      resolvedRole,
      teamMatch: resolved.team,
    };
  });

  const summary: IconsImportCheckSummary = {
    totalRows: analyzedRows.length,
    validRows: analyzedRows.filter(
      (row) => row.blockingIssueCount === 0 && row.warningIssueCount === 0,
    ).length,
    blockingRows: analyzedRows.filter((row) => row.blockingIssueCount > 0)
      .length,
    warningRows: analyzedRows.filter((row) => row.warningIssueCount > 0).length,
    missingHeaders,
    missingFieldRows: analyzedRows.filter((row) =>
      row.issues.some((issue) => issue.code === "MISSING_REQUIRED_FIELD"),
    ).length,
    unknownTeamRows: analyzedRows.filter((row) =>
      row.issues.some((issue) => issue.code === "UNKNOWN_TEAM"),
    ).length,
    ambiguousTeamRows: analyzedRows.filter((row) =>
      row.issues.some((issue) => issue.code === "AMBIGUOUS_TEAM"),
    ).length,
    invalidRoleRows: analyzedRows.filter((row) =>
      row.issues.some((issue) => issue.code === "INVALID_ROLE"),
    ).length,
    duplicateTeamRoleRows: analyzedRows.filter((row) =>
      row.issues.some((issue) => issue.code === "CSV_DUPLICATE_TEAM_ROLE"),
    ).length,
    invalidImageUrlRows: analyzedRows.filter((row) =>
      row.issues.some((issue) => issue.code === "INVALID_IMAGE_URL"),
    ).length,
    invalidPointsRows: analyzedRows.filter((row) =>
      row.issues.some((issue) => issue.code === "INVALID_POINTS"),
    ).length,
    teamPointsConflictRows: analyzedRows.filter((row) =>
      row.issues.some((issue) => issue.code === "TEAM_POINTS_CONFLICT"),
    ).length,
  };

  return {
    rows: analyzedRows,
    summary,
    hasBlockingIssues:
      summary.missingHeaders.length > 0 || summary.blockingRows > 0,
  };
}
