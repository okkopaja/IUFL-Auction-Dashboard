import type { ImportDraftRow, RawCsvRow } from "./types";

/** Trim a string; return null if blank. */
function toNullable(val: string | undefined): string | null {
  const trimmed = (val ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** Trim a string; return empty string if blank. */
function toString(val: string | undefined): string {
  return (val ?? "").trim();
}

/**
 * Convert a raw CSV row into a structured ImportDraftRow.
 * Does NOT validate; just normalises field names and trims values.
 */
export function normalizeRow(raw: RawCsvRow, index: number): ImportDraftRow {
  // Use CSV header names as keys into the raw row (PapaParse keys by header)
  const name = toString(raw["NAME"]);
  const year = toString(raw["YEAR"]);
  const whatsappNumber = toString(raw["Whatsapp Number"]);
  const stream = toString(raw["STREAM"]);
  const position1 = toString(raw["Primary Position"]);
  // Support both the typo variant ("Secondary Postion") and correct spelling
  const position2Raw = toNullable(
    raw["Secondary Postion"] ?? raw["Secondary Position"],
  );

  return {
    _key: `row-${index}`,
    name,
    year,
    whatsappNumber,
    stream,
    position1,
    position2: position2Raw,
    importOrder: index,
    errors: {},
    hasErrors: false,
  };
}

/**
 * Re-assign importOrder after rows are reordered or removed.
 */
export function reorderRows(rows: ImportDraftRow[]): ImportDraftRow[] {
  return rows.map((r, i) => ({ ...r, importOrder: i }));
}
