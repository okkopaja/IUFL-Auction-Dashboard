export const REQUIRED_HEADERS = ["NAME", "TEAM NAME", "STATUS"] as const;

export const OPTIONAL_HEADERS = ["IMAGE URL", "POINTS"] as const;

export const HEADER_ALIASES = {
  NAME: "NAME",
  "TEAM NAME": "TEAM NAME",
  TEAM: "TEAM NAME",
  STATUS: "STATUS",
  ROLE: "STATUS",
  "IMAGE URL": "IMAGE URL",
  IMAGE: "IMAGE URL",
  POINTS: "POINTS",
} as const;

export type CanonicalHeader =
  | (typeof REQUIRED_HEADERS)[number]
  | (typeof OPTIONAL_HEADERS)[number];
