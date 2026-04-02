import { REQUIRED_HEADERS } from "./constants";
import { normalizePlayerIdentityKey } from "./normalize";
import type {
  ImportCheckIssue,
  ImportCheckRowResult,
  ImportCheckSummary,
  ImportCommitRow,
  ImportDbMatchSnapshot,
  ImportMode,
  ImportResolutionAction,
} from "./types";

export interface ImportAnalysisInput {
  mode: ImportMode;
  headers: string[];
  rows: ImportCommitRow[];
  existingPlayers: ImportDbMatchSnapshot[];
  extraIssuesByRowKey?:
    | Map<string, ImportCheckIssue[]>
    | Record<string, ImportCheckIssue[]>;
}

export interface ImportAnalysisResult {
  rows: ImportCheckRowResult[];
  summary: ImportCheckSummary;
  hasBlockingIssues: boolean;
}

const REQUIRED_ROW_FIELDS: Array<{
  field: keyof ImportCommitRow;
  label: string;
}> = [
  { field: "name", label: "NAME" },
  { field: "year", label: "YEAR" },
  { field: "stream", label: "STREAM" },
  { field: "position1", label: "Primary Position" },
];

function makeIssue(
  issue: Omit<ImportCheckIssue, "severity"> & {
    severity?: ImportCheckIssue["severity"];
  },
): ImportCheckIssue {
  return {
    severity: issue.severity ?? "blocking",
    ...issue,
  };
}

function defaultResolutionForRow(
  mode: ImportMode,
  hasMissingField: boolean,
  hasCsvDuplicate: boolean,
  hasOtherBlockingIssue: boolean,
  hasDbDuplicate: boolean,
): {
  resolutionRequired: boolean;
  allowedActions: ImportResolutionAction[];
  suggestedAction: ImportResolutionAction;
} {
  if (hasMissingField || hasCsvDuplicate || hasOtherBlockingIssue) {
    return {
      resolutionRequired: true,
      allowedActions: ["SKIP"],
      suggestedAction: "SKIP",
    };
  }

  if (mode === "APPEND" && hasDbDuplicate) {
    return {
      resolutionRequired: true,
      allowedActions: ["UPDATE", "SKIP"],
      suggestedAction: "UPDATE",
    };
  }

  return {
    resolutionRequired: false,
    allowedActions: ["INSERT", "SKIP"],
    suggestedAction: "INSERT",
  };
}

export function analyzeImportRows({
  mode,
  headers,
  rows,
  existingPlayers,
  extraIssuesByRowKey,
}: ImportAnalysisInput): ImportAnalysisResult {
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));

  const firstRowByIdentity = new Map<
    string,
    { rowKey: string; rowNumber: number }
  >();

  const existingByIdentity = new Map<string, ImportDbMatchSnapshot>();
  for (const existing of existingPlayers) {
    const key = normalizePlayerIdentityKey(
      existing.name,
      existing.whatsappNumber,
    );
    if (!existingByIdentity.has(key)) {
      existingByIdentity.set(key, existing);
    }
  }

  const analyzedRows: ImportCheckRowResult[] = rows.map((row) => {
    const issues: ImportCheckIssue[] = [];

    for (const requiredField of REQUIRED_ROW_FIELDS) {
      const raw = row[requiredField.field];
      const val = typeof raw === "string" ? raw.trim() : "";
      if (!val) {
        issues.push(
          makeIssue({
            code: "MISSING_REQUIRED_FIELD",
            message: `${requiredField.label} is required`,
            field: requiredField.field,
          }),
        );
      }
    }

    const normalizedKey = normalizePlayerIdentityKey(
      row.name,
      row.whatsappNumber,
    );

    const duplicateAnchor = firstRowByIdentity.get(normalizedKey);
    if (!duplicateAnchor) {
      firstRowByIdentity.set(normalizedKey, {
        rowKey: row.rowKey,
        rowNumber: row.importOrder + 1,
      });
    } else {
      issues.push(
        makeIssue({
          code: "CSV_DUPLICATE",
          message: `Duplicate of row ${duplicateAnchor.rowNumber}`,
          relatedRowKey: duplicateAnchor.rowKey,
          relatedRowNumber: duplicateAnchor.rowNumber,
        }),
      );
    }

    const dbMatch = existingByIdentity.get(normalizedKey) ?? null;
    if (dbMatch) {
      issues.push(
        makeIssue({
          code: "DB_DUPLICATE",
          severity: mode === "APPEND" ? "blocking" : "warning",
          message:
            mode === "APPEND"
              ? `Matches existing database player ${dbMatch.name}`
              : `Will replace existing database player ${dbMatch.name}`,
        }),
      );
    }

    const extraIssues =
      extraIssuesByRowKey instanceof Map
        ? (extraIssuesByRowKey.get(row.rowKey) ?? [])
        : (extraIssuesByRowKey?.[row.rowKey] ?? []);
    if (extraIssues.length > 0) {
      issues.push(...extraIssues);
    }

    const blockingIssueCount = issues.filter(
      (issue) => issue.severity === "blocking",
    ).length;
    const warningIssueCount = issues.filter(
      (issue) => issue.severity === "warning",
    ).length;

    const hasMissingField = issues.some(
      (issue) => issue.code === "MISSING_REQUIRED_FIELD",
    );
    const hasCsvDuplicate = issues.some(
      (issue) => issue.code === "CSV_DUPLICATE",
    );
    const hasOtherBlockingIssue = issues.some(
      (issue) => issue.severity === "blocking" && issue.code !== "DB_DUPLICATE",
    );
    const hasDbDuplicate = issues.some(
      (issue) => issue.code === "DB_DUPLICATE",
    );

    const resolution = defaultResolutionForRow(
      mode,
      hasMissingField,
      hasCsvDuplicate,
      hasOtherBlockingIssue,
      hasDbDuplicate,
    );

    return {
      rowKey: row.rowKey,
      importOrder: row.importOrder,
      normalizedKey,
      issues,
      blockingIssueCount,
      warningIssueCount,
      resolutionRequired: resolution.resolutionRequired,
      allowedActions: resolution.allowedActions,
      suggestedAction: resolution.suggestedAction,
      dbMatch,
    };
  });

  const summary: ImportCheckSummary = {
    totalRows: analyzedRows.length,
    validRows: analyzedRows.filter(
      (row) => row.blockingIssueCount === 0 && row.warningIssueCount === 0,
    ).length,
    blockingRows: analyzedRows.filter((row) => row.blockingIssueCount > 0)
      .length,
    warningRows: analyzedRows.filter((row) => row.warningIssueCount > 0).length,
    csvDuplicateRows: analyzedRows.filter((row) =>
      row.issues.some((issue) => issue.code === "CSV_DUPLICATE"),
    ).length,
    dbDuplicateRows: analyzedRows.filter((row) =>
      row.issues.some((issue) => issue.code === "DB_DUPLICATE"),
    ).length,
    missingFieldRows: analyzedRows.filter((row) =>
      row.issues.some((issue) => issue.code === "MISSING_REQUIRED_FIELD"),
    ).length,
    imageUrlIssueRows: analyzedRows.filter((row) =>
      row.issues.some(
        (issue) =>
          issue.code === "INVALID_IMAGE_URL" ||
          issue.code === "DRIVE_URL_NON_PUBLIC" ||
          issue.code === "DRIVE_URL_CHECK_FAILED",
      ),
    ).length,
    missingHeaders,
  };

  return {
    rows: analyzedRows,
    summary,
    hasBlockingIssues:
      summary.missingHeaders.length > 0 || summary.blockingRows > 0,
  };
}
