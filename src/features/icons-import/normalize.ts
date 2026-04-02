import type { TeamRole } from "@/types";
import {
  type CanonicalHeader,
  HEADER_ALIASES,
  REQUIRED_HEADERS,
} from "./constants";
import type {
  IconsImportCommitRow,
  IconsImportDraftRow,
  RawCsvRow,
} from "./types";

export function normalizeHeaderToken(header: string): string {
  return header.trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeTeamKey(teamName: string): string {
  return teamName.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeStatusKey(status: string): string {
  return status
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
}

const POINTS_PATTERN = /^(?:\d+|\d{1,3}(?:,\d{3})+)$/;

export function parsePointsValue(points: string | null | undefined): {
  parsedPoints: number | null;
  isValid: boolean;
} {
  const trimmed = (points ?? "").trim();
  if (!trimmed) {
    return {
      parsedPoints: null,
      isValid: true,
    };
  }

  if (!POINTS_PATTERN.test(trimmed)) {
    return {
      parsedPoints: null,
      isValid: false,
    };
  }

  const normalized = trimmed.replace(/,/g, "");
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return {
      parsedPoints: null,
      isValid: false,
    };
  }

  return {
    parsedPoints: parsed,
    isValid: true,
  };
}

function toNullable(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTrimmed(value: string | undefined): string {
  return (value ?? "").trim();
}

export function parseStatusToRole(status: string): TeamRole | null {
  const normalized = normalizeStatusKey(status);

  if (normalized === "OWNER") return "OWNER";
  if (normalized === "COOWNER") return "CO_OWNER";
  if (normalized === "CAPTAIN") return "CAPTAIN";
  if (normalized === "MARQUEE") return "MARQUEE";

  return null;
}

export function buildTeamRoleIdentityKey(
  teamName: string,
  role: TeamRole | null,
  rawStatus: string,
): string {
  const roleKey = role ?? normalizeStatusKey(rawStatus);
  return `${normalizeTeamKey(teamName)}::${roleKey}`;
}

export function buildHeaderLookup(rawHeaders: string[]): {
  canonicalToRaw: Partial<Record<CanonicalHeader, string>>;
  missingHeaders: string[];
} {
  const canonicalToRaw: Partial<Record<CanonicalHeader, string>> = {};

  for (const header of rawHeaders) {
    const normalized = normalizeHeaderToken(header);
    const canonical = HEADER_ALIASES[normalized as keyof typeof HEADER_ALIASES];
    if (!canonical) continue;

    if (!canonicalToRaw[canonical]) {
      canonicalToRaw[canonical] = header;
    }
  }

  const missingHeaders = REQUIRED_HEADERS.filter(
    (requiredHeader) => !canonicalToRaw[requiredHeader],
  );

  return {
    canonicalToRaw,
    missingHeaders,
  };
}

function getRawValue(
  row: RawCsvRow,
  canonicalToRaw: Partial<Record<CanonicalHeader, string>>,
  header: CanonicalHeader,
): string | undefined {
  const sourceHeader = canonicalToRaw[header];
  if (!sourceHeader) return undefined;
  return row[sourceHeader];
}

export function normalizeRow(
  row: RawCsvRow,
  index: number,
  canonicalToRaw: Partial<Record<CanonicalHeader, string>>,
): IconsImportDraftRow {
  const name = toTrimmed(getRawValue(row, canonicalToRaw, "NAME"));
  const teamName = toTrimmed(getRawValue(row, canonicalToRaw, "TEAM NAME"));
  const status = toTrimmed(getRawValue(row, canonicalToRaw, "STATUS"));
  const imageUrl = toNullable(getRawValue(row, canonicalToRaw, "IMAGE URL"));
  const points = toNullable(getRawValue(row, canonicalToRaw, "POINTS"));

  return {
    _key: `row-${index}`,
    name,
    teamName,
    status,
    imageUrl,
    points,
    importOrder: index,
    errors: {},
    hasErrors: false,
  };
}

export function toCommitRow(row: IconsImportDraftRow): IconsImportCommitRow {
  return {
    rowKey: row._key,
    name: row.name.trim(),
    teamName: row.teamName.trim(),
    status: row.status.trim(),
    imageUrl: row.imageUrl?.trim() || null,
    points: row.points?.trim() || null,
    importOrder: row.importOrder,
  };
}
