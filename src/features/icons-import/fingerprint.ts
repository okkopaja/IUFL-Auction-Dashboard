import { createHash } from "node:crypto";
import type { IconsImportCommitRow, IconsImportMode } from "./types";

interface BuildIconsImportFingerprintInput {
  sessionId: string;
  mode: IconsImportMode;
  headers: string[];
  rows: IconsImportCommitRow[];
}

export function buildIconsImportCheckFingerprint({
  sessionId,
  mode,
  headers,
  rows,
}: BuildIconsImportFingerprintInput): string {
  const canonicalRows = [...rows]
    .sort((a, b) => a.importOrder - b.importOrder)
    .map((row) => ({
      rowKey: row.rowKey,
      name: row.name.trim(),
      teamName: row.teamName.trim(),
      status: row.status.trim(),
      imageUrl: (row.imageUrl ?? "").trim(),
      points: (row.points ?? "").trim(),
      importOrder: row.importOrder,
    }));

  const canonicalHeaders = [...headers].map((h) => h.trim()).sort();

  return createHash("sha256")
    .update(
      JSON.stringify({
        sessionId,
        mode,
        headers: canonicalHeaders,
        rows: canonicalRows,
      }),
    )
    .digest("hex");
}
