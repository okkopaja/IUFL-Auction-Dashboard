/** Exact CSV headers expected (case-sensitive). */
export const REQUIRED_HEADERS = [
  "NAME",
  "YEAR",
  "Whatsapp Number",
  "STREAM",
  "Primary Position",
] as const;

export const OPTIONAL_HEADERS = [
  "Secondary Postion", // intentional typo in source data
] as const;

/** Maps CSV column header → internal DB field name */
export const FIELD_MAPPING: Record<string, string> = {
  NAME: "name",
  YEAR: "year",
  "Whatsapp Number": "whatsappNumber",
  STREAM: "stream",
  "Primary Position": "position1",
  "Secondary Postion": "position2",
};

export const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS] as const;
