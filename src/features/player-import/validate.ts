import { REQUIRED_HEADERS } from "./constants";
import { normalizePlayerIdentityKey } from "./normalize";
import type { ImportDraftRow } from "./types";

export interface RemoveCsvDuplicatesResult {
  rows: ImportDraftRow[];
  removedCount: number;
}

/**
 * Drop duplicate CSV rows by normalized player identity.
 * The first matching row is kept and later duplicates are removed.
 */
export function removeCsvDuplicates(
  rows: ImportDraftRow[],
): RemoveCsvDuplicatesResult {
  const seenIdentityKeys = new Set<string>();
  const deduplicatedRows: ImportDraftRow[] = [];
  let removedCount = 0;

  for (const row of rows) {
    if (!row.name.trim()) {
      deduplicatedRows.push(row);
      continue;
    }

    const identityKey = normalizePlayerIdentityKey(
      row.name,
      row.whatsappNumber,
    );
    if (seenIdentityKeys.has(identityKey)) {
      removedCount += 1;
      continue;
    }

    seenIdentityKeys.add(identityKey);
    deduplicatedRows.push(row);
  }

  return {
    rows: deduplicatedRows.map((row, index) => ({
      ...row,
      importOrder: index,
    })),
    removedCount,
  };
}

/** Validate a draft row; returns the row with errors populated. */
export function validateRow(
  row: ImportDraftRow,
  allRows: ImportDraftRow[],
): ImportDraftRow {
  const errors: Record<string, string> = {};

  if (!row.name) errors.name = "Name is required";
  if (!row.year) errors.year = "Year is required";
  if (!row.stream) errors.stream = "Stream is required";
  if (!row.position1) errors.position1 = "Primary position is required";

  // Duplicate detection: same normalized identity elsewhere.
  const rowKey = normalizePlayerIdentityKey(row.name, row.whatsappNumber);
  const duplicateIdx = allRows.findIndex(
    (r) =>
      r._key !== row._key &&
      normalizePlayerIdentityKey(r.name, r.whatsappNumber) === rowKey,
  );
  if (duplicateIdx !== -1) {
    errors.name = `Duplicate of row ${duplicateIdx + 1}`;
  }

  return { ...row, errors, hasErrors: Object.keys(errors).length > 0 };
}

/** Run validateRow over all rows with full cross-row context. */
export function validateAllRows(rows: ImportDraftRow[]): ImportDraftRow[] {
  return rows.map((row) => validateRow(row, rows));
}

/**
 * Check that parsed CSV has all required headers.
 * Returns an array of missing header names (empty = ok).
 */
export function checkHeaders(rawHeaders: string[]): string[] {
  return REQUIRED_HEADERS.filter((h) => !rawHeaders.includes(h));
}
