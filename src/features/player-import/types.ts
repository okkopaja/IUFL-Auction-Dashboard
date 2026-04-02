/** Raw row from PapaParse: header → value (all strings). */
export type RawCsvRow = Record<string, string>;

export type ImportMode = "APPEND" | "REPLACE";

export type ImportResolutionAction = "INSERT" | "UPDATE" | "SKIP";

export type ImportIssueCode =
  | "MISSING_REQUIRED_HEADER"
  | "MISSING_REQUIRED_FIELD"
  | "CSV_DUPLICATE"
  | "DB_DUPLICATE"
  | "INVALID_IMAGE_URL"
  | "DRIVE_URL_NON_PUBLIC"
  | "DRIVE_URL_CHECK_FAILED";

export type ImportIssueSeverity = "blocking" | "warning";

/** A single row in the import draft, post-normalization. */
export interface ImportDraftRow {
  /** Client-side stable key for React lists */
  _key: string;
  name: string;
  year: string;
  whatsappNumber: string | null;
  stream: string;
  position1: string;
  position2: string | null;
  imageUrl: string | null;
  importOrder: number;
  /** Validation errors keyed by field name */
  errors: Record<string, string>;
  /** Whether this row has any errors */
  hasErrors: boolean;
}

/** Shape of a row used by the player import check/commit workflow */
export interface ImportCommitRow {
  rowKey: string;
  name: string;
  year: string;
  whatsappNumber: string | null;
  stream: string;
  position1: string;
  position2: string | null;
  imageUrl: string | null;
  importOrder: number;
}

export interface ImportCommitPayload {
  mode: ImportMode;
  checkId: string;
  checkFingerprint: string;
  rows: ImportCommitRow[];
  resolutions: ImportConflictResolution[];
}

export interface ImportCheckPayload {
  mode: ImportMode;
  headers: string[];
  rows: ImportCommitRow[];
}

export interface ImportCheckIssue {
  code: ImportIssueCode;
  severity: ImportIssueSeverity;
  message: string;
  field?: keyof ImportCommitRow;
  relatedRowKey?: string;
  relatedRowNumber?: number;
}

export interface ImportDbMatchSnapshot {
  id: string;
  name: string;
  whatsappNumber: string | null;
  status: "UNSOLD" | "IN_AUCTION" | "SOLD";
  teamId: string | null;
}

export interface ImportCheckRowResult {
  rowKey: string;
  importOrder: number;
  normalizedKey: string;
  issues: ImportCheckIssue[];
  blockingIssueCount: number;
  warningIssueCount: number;
  resolutionRequired: boolean;
  allowedActions: ImportResolutionAction[];
  suggestedAction: ImportResolutionAction;
  dbMatch: ImportDbMatchSnapshot | null;
}

export interface ImportCheckSummary {
  totalRows: number;
  validRows: number;
  blockingRows: number;
  warningRows: number;
  csvDuplicateRows: number;
  dbDuplicateRows: number;
  missingFieldRows: number;
  imageUrlIssueRows: number;
  missingHeaders: string[];
}

export interface ImportCheckResult {
  mode: ImportMode;
  sessionId: string;
  checkId: string;
  checkFingerprint: string;
  checkedAt: string;
  rows: ImportCheckRowResult[];
  summary: ImportCheckSummary;
  hasBlockingIssues: boolean;
}

export interface ImportConflictResolution {
  rowKey: string;
  action: ImportResolutionAction;
}

export type ImportImageRunStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS";

export interface ImportImageIngestionFailureRow {
  rowNumber: number;
  playerId: string;
  playerName: string;
  imageUrl: string;
  error: string;
}

export interface ImportImageIngestionProgress {
  runId: string;
  status: ImportImageRunStatus;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  percent: number;
  failedRows: ImportImageIngestionFailureRow[];
}

export interface ImportCommitResult {
  mode: ImportMode;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  unresolvedCount: number;
  importedCount: number;
  removedPlayersCount: number;
  removedTransactionsCount: number;
  sessionId: string;
  imageIngestion: ImportImageIngestionProgress | null;
}
