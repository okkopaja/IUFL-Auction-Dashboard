import { parsePointsValue, parseStatusToRole } from "./normalize";
import type { IconsImportDraftRow } from "./types";

function isValidImageUrl(imageUrl: string): boolean {
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateRow(row: IconsImportDraftRow): IconsImportDraftRow {
  const errors: Record<string, string> = {};

  if (!row.name.trim()) {
    errors.name = "Name is required";
  }

  if (!row.teamName.trim()) {
    errors.teamName = "Team name is required";
  }

  if (!row.status.trim()) {
    errors.status = "Status is required";
  } else if (!parseStatusToRole(row.status)) {
    errors.status = "Status must be OWNER, CO-OWNER, CAPTAIN, or MARQUEE";
  }

  if (row.imageUrl && !isValidImageUrl(row.imageUrl)) {
    errors.imageUrl = "Image URL must be a valid http(s) URL";
  }

  const parsedPoints = parsePointsValue(row.points);
  if (!parsedPoints.isValid) {
    errors.points = "Points must be a whole number (for example 2900)";
  }

  return {
    ...row,
    errors,
    hasErrors: Object.keys(errors).length > 0,
  };
}

export function validateAllRows(
  rows: IconsImportDraftRow[],
): IconsImportDraftRow[] {
  return rows.map((row) => validateRow(row));
}
