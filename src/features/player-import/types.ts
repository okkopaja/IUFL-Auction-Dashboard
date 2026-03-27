/** Raw row from PapaParse: header → value (all strings). */
export type RawCsvRow = Record<string, string>;

/** A single row in the import draft, post-normalization. */
export interface ImportDraftRow {
  /** Client-side stable key for React lists */
  _key: string;
  name: string;
  year: string;
  whatsappNumber: string;
  stream: string;
  position1: string;
  position2: string | null;
  importOrder: number;
  /** Validation errors keyed by field name */
  errors: Record<string, string>;
  /** Whether this row has any errors */
  hasErrors: boolean;
}

/** Shape that gets POSTed to /api/admin/player-import/replace */
export interface ImportCommitRow {
  name: string;
  year: string;
  whatsappNumber: string;
  stream: string;
  position1: string;
  position2: string | null;
  importOrder: number;
}

export interface ImportCommitPayload {
  rows: ImportCommitRow[];
}

export interface ImportCommitResult {
  importedCount: number;
  removedPlayersCount: number;
  removedTransactionsCount: number;
  sessionId: string;
}
