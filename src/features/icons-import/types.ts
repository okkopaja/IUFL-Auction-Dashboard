import type { TeamRole } from "@/types";

export type RawCsvRow = Record<string, string>;

export type IconsImportMode = "APPEND" | "REPLACE";

export type IconsImportResolutionAction = "UPSERT" | "SKIP";

export type IconsImportIssueCode =
  | "MISSING_REQUIRED_HEADER"
  | "MISSING_REQUIRED_FIELD"
  | "UNKNOWN_TEAM"
  | "AMBIGUOUS_TEAM"
  | "INVALID_ROLE"
  | "CSV_DUPLICATE_TEAM_ROLE"
  | "INVALID_IMAGE_URL"
  | "INVALID_POINTS"
  | "TEAM_POINTS_CONFLICT";

export type IconsImportIssueSeverity = "blocking" | "warning";

export interface IconsImportDraftRow {
  _key: string;
  name: string;
  teamName: string;
  status: string;
  imageUrl: string | null;
  points: string | null;
  importOrder: number;
  errors: Record<string, string>;
  hasErrors: boolean;
}

export interface IconsImportCommitRow {
  rowKey: string;
  name: string;
  teamName: string;
  status: string;
  imageUrl: string | null;
  points: string | null;
  importOrder: number;
}

export interface IconsImportCheckPayload {
  mode: IconsImportMode;
  headers: string[];
  rows: IconsImportCommitRow[];
}

export interface IconsImportIssue {
  code: IconsImportIssueCode;
  severity: IconsImportIssueSeverity;
  message: string;
  field?: keyof IconsImportCommitRow;
  relatedRowKey?: string;
  relatedRowNumber?: number;
}

export interface IconsImportTeamMatch {
  id: string;
  name: string;
  shortCode: string;
}

export interface IconsImportCheckRowResult {
  rowKey: string;
  importOrder: number;
  normalizedTeamRoleKey: string;
  issues: IconsImportIssue[];
  blockingIssueCount: number;
  warningIssueCount: number;
  resolutionRequired: boolean;
  allowedActions: IconsImportResolutionAction[];
  suggestedAction: IconsImportResolutionAction;
  resolvedRole: TeamRole | null;
  teamMatch: IconsImportTeamMatch | null;
}

export interface IconsImportCheckSummary {
  totalRows: number;
  validRows: number;
  blockingRows: number;
  warningRows: number;
  missingHeaders: string[];
  missingFieldRows: number;
  unknownTeamRows: number;
  ambiguousTeamRows: number;
  invalidRoleRows: number;
  duplicateTeamRoleRows: number;
  invalidImageUrlRows: number;
  invalidPointsRows: number;
  teamPointsConflictRows: number;
}

export interface IconsImportCheckResult {
  mode: IconsImportMode;
  sessionId: string;
  checkId: string;
  checkFingerprint: string;
  checkedAt: string;
  rows: IconsImportCheckRowResult[];
  summary: IconsImportCheckSummary;
  hasBlockingIssues: boolean;
}

export interface IconsImportConflictResolution {
  rowKey: string;
  action: IconsImportResolutionAction;
}

export interface IconsImportCommitPayload {
  mode: IconsImportMode;
  checkId: string;
  checkFingerprint: string;
  rows: IconsImportCommitRow[];
  resolutions: IconsImportConflictResolution[];
}

export type IconsImportImageRunStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS";

export interface IconsImportImageIngestionFailureRow {
  rowKey: string;
  rowNumber: number;
  name: string;
  teamName: string;
  role: TeamRole;
  imageUrl: string;
  error: string;
}

export interface IconsImportImageIngestionProgress {
  runId: string;
  status: IconsImportImageRunStatus;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  percent: number;
  failedRows: IconsImportImageIngestionFailureRow[];
}

export interface IconsImportCommitResult {
  mode: IconsImportMode;
  sessionId: string;
  upsertedCount: number;
  skippedCount: number;
  teamsTouched: number;
  teamPointsUpdatedCount: number;
  replacedProfilesCount: number;
  imageIngestion: IconsImportImageIngestionProgress | null;
}

export interface IconsImportTeamLookupRow {
  id: string;
  name: string;
  shortCode: string;
}
