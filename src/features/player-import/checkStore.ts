import type { ImportCheckResult, ImportCommitRow, ImportMode } from "./types";

const CHECK_TTL_MS = 15 * 60 * 1000;

export interface ImportCheckRecord {
  checkId: string;
  sessionId: string;
  mode: ImportMode;
  headers: string[];
  rows: ImportCommitRow[];
  fingerprint: string;
  createdAt: number;
  expiresAt: number;
  result: ImportCheckResult;
}

const globals = globalThis as typeof globalThis & {
  __playerImportCheckStore?: Map<string, ImportCheckRecord>;
};

const store =
  globals.__playerImportCheckStore ?? new Map<string, ImportCheckRecord>();
if (!globals.__playerImportCheckStore) {
  globals.__playerImportCheckStore = store;
}

function pruneExpiredChecks() {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.expiresAt <= now) {
      store.delete(key);
    }
  }
}

export function saveImportCheckRecord(
  record: Omit<ImportCheckRecord, "createdAt" | "expiresAt">,
): ImportCheckRecord {
  pruneExpiredChecks();
  const now = Date.now();
  const fullRecord: ImportCheckRecord = {
    ...record,
    createdAt: now,
    expiresAt: now + CHECK_TTL_MS,
  };
  store.set(record.checkId, fullRecord);
  return fullRecord;
}

export function getImportCheckRecord(
  checkId: string,
): ImportCheckRecord | null {
  pruneExpiredChecks();
  return store.get(checkId) ?? null;
}

export function consumeImportCheckRecord(checkId: string): void {
  store.delete(checkId);
}
