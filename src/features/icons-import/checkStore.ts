import type {
  IconsImportCheckResult,
  IconsImportCommitRow,
  IconsImportMode,
} from "./types";

const CHECK_TTL_MS = 15 * 60 * 1000;

export interface IconsImportCheckRecord {
  checkId: string;
  mode: IconsImportMode;
  sessionId: string;
  headers: string[];
  rows: IconsImportCommitRow[];
  fingerprint: string;
  createdAt: number;
  expiresAt: number;
  result: IconsImportCheckResult;
}

const globals = globalThis as typeof globalThis & {
  __iconsImportCheckStore?: Map<string, IconsImportCheckRecord>;
};

const store =
  globals.__iconsImportCheckStore ?? new Map<string, IconsImportCheckRecord>();
if (!globals.__iconsImportCheckStore) {
  globals.__iconsImportCheckStore = store;
}

function pruneExpiredChecks() {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.expiresAt <= now) {
      store.delete(key);
    }
  }
}

export function saveIconsImportCheckRecord(
  record: Omit<IconsImportCheckRecord, "createdAt" | "expiresAt">,
): IconsImportCheckRecord {
  pruneExpiredChecks();
  const now = Date.now();
  const fullRecord: IconsImportCheckRecord = {
    ...record,
    createdAt: now,
    expiresAt: now + CHECK_TTL_MS,
  };
  store.set(record.checkId, fullRecord);
  return fullRecord;
}

export function getIconsImportCheckRecord(
  checkId: string,
): IconsImportCheckRecord | null {
  pruneExpiredChecks();
  return store.get(checkId) ?? null;
}

export function consumeIconsImportCheckRecord(checkId: string): void {
  store.delete(checkId);
}
