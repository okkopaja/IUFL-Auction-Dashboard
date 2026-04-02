import type { ImportCommitRow, ImportDraftRow, RawCsvRow } from "./types";

/** Trim a string; return null if blank. */
function toNullable(val: string | undefined): string | null {
  const trimmed = (val ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** Trim a string; return empty string if blank. */
function toTrimmedString(val: string | undefined): string {
  return (val ?? "").trim();
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeWhatsappNumber(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, "");
}

/** Stable key used for duplicate checks across CSV rows and DB rows. */
export function normalizePlayerIdentityKey(
  name: string,
  whatsappNumber: string | null | undefined,
): string {
  return `${normalizeName(name)}::${normalizeWhatsappNumber(whatsappNumber ?? "")}`;
}

/**
 * Convert a raw CSV row into a structured ImportDraftRow.
 * Does NOT validate; just normalises field names and trims values.
 */
export function normalizeRow(raw: RawCsvRow, index: number): ImportDraftRow {
  // Use CSV header names as keys into the raw row (PapaParse keys by header)
  const name = toTrimmedString(raw.NAME);
  const year = toTrimmedString(raw.YEAR);
  const whatsappNumber = toNullable(raw["Whatsapp Number"]);
  const stream = toTrimmedString(raw.STREAM);
  const position1 = toTrimmedString(raw["Primary Position"]);
  // Support both the typo variant ("Secondary Postion") and correct spelling
  const position2Raw = toNullable(
    raw["Secondary Postion"] ?? raw["Secondary Position"],
  );
  const imageUrlRaw = toNullable(raw["Image URL"]);

  return {
    _key: `row-${index}`,
    name,
    year,
    whatsappNumber,
    stream,
    position1,
    position2: position2Raw,
    imageUrl: imageUrlRaw,
    importOrder: index,
    errors: {},
    hasErrors: false,
  };
}

/** Convert a draft row into a commit/check payload row. */
export function toCommitRow(row: ImportDraftRow): ImportCommitRow {
  return {
    rowKey: row._key,
    name: toTrimmedString(row.name),
    year: toTrimmedString(row.year),
    whatsappNumber: toNullable(row.whatsappNumber ?? undefined),
    stream: toTrimmedString(row.stream),
    position1: toTrimmedString(row.position1),
    position2: toNullable(row.position2 ?? undefined),
    imageUrl: toNullable(row.imageUrl ?? undefined),
    importOrder: row.importOrder,
  };
}

/**
 * Re-assign importOrder after rows are reordered or removed.
 */
export function reorderRows(rows: ImportDraftRow[]): ImportDraftRow[] {
  return rows.map((r, i) => ({ ...r, importOrder: i }));
}
