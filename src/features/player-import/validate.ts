import { REQUIRED_HEADERS } from "./constants";
import type { ImportDraftRow, RawCsvRow } from "./types";

/** Validate a draft row; returns the row with errors populated. */
export function validateRow(
  row: ImportDraftRow,
  allRows: ImportDraftRow[],
): ImportDraftRow {
  const errors: Record<string, string> = {};

  if (!row.name) errors.name = "Name is required";
  if (!row.year) errors.year = "Year is required";
  if (!row.whatsappNumber)
    errors.whatsappNumber = "WhatsApp number is required";
  if (!row.stream) errors.stream = "Stream is required";
  if (!row.position1) errors.position1 = "Primary position is required";

  // Duplicate detection: same name + whatsappNumber elsewhere
  const duplicateIdx = allRows.findIndex(
    (r) =>
      r._key !== row._key &&
      r.name.toLowerCase() === row.name.toLowerCase() &&
      r.whatsappNumber === row.whatsappNumber,
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
