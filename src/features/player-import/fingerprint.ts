import { createHash } from "node:crypto";
import type { ImportCommitRow, ImportMode } from "./types";

interface BuildFingerprintInput {
  sessionId: string;
  mode: ImportMode;
  headers: string[];
  rows: ImportCommitRow[];
}

export function buildImportCheckFingerprint({
  sessionId,
  mode,
  headers,
  rows,
}: BuildFingerprintInput): string {
  const canonicalRows = [...rows]
    .sort((a, b) => a.importOrder - b.importOrder)
    .map((row) => ({
      rowKey: row.rowKey,
      name: row.name.trim(),
      year: row.year.trim(),
      whatsappNumber: (row.whatsappNumber ?? "").trim(),
      stream: row.stream.trim(),
      position1: row.position1.trim(),
      position2: (row.position2 ?? "").trim(),
      imageUrl: (row.imageUrl ?? "").trim(),
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
