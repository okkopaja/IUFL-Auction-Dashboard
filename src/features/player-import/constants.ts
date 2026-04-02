/** Exact CSV headers expected (case-sensitive). */
export const REQUIRED_HEADERS = [
  "NAME",
  "YEAR",
  "STREAM",
  "Primary Position",
] as const;

/** Optional CSV headers accepted when present (case-sensitive). */
export const OPTIONAL_HEADERS = [
  "Whatsapp Number",
  "Secondary Position",
  "Image URL",
] as const;

/** Legacy header aliases accepted only for normalization compatibility. */
export const LEGACY_HEADER_ALIASES = {
  "Secondary Postion": "Secondary Position",
} as const;

/** Maps CSV column header → internal DB field name */
export const FIELD_MAPPING: Record<string, string> = {
  NAME: "name",
  YEAR: "year",
  "Whatsapp Number": "whatsappNumber",
  STREAM: "stream",
  "Primary Position": "position1",
  "Secondary Position": "position2",
  "Secondary Postion": "position2",
  "Image URL": "imageUrl",
};

export const ALL_HEADERS = [
  ...REQUIRED_HEADERS,
  ...OPTIONAL_HEADERS,
  ...Object.keys(LEGACY_HEADER_ALIASES),
] as const;
