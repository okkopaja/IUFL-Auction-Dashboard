import { promises as fs } from "node:fs";
import path from "node:path";
import { getPositionGroup, type PositionGroup } from "@/lib/playerFilters";

const RESET_POSITION_ORDER: PositionGroup[] = [
  "GK",
  "DEFENCE",
  "MIDFIELDER",
  "ATTACKER",
];

const CSV_HEADER_ALIASES: Record<PositionGroup, string[]> = {
  GK: ["gk", "goalkeeper", "goalkeeper"],
  DEFENCE: ["defence", "defender", "defenders", "defense"],
  MIDFIELDER: ["midfield", "midfielder", "midfielders", "mid"],
  ATTACKER: ["forward", "forwards", "attacker", "attackers", "fwd"],
};

const DEFAULT_CSV_PATH = path.join(
  process.cwd(),
  "docs",
  "Player-sequence.csv",
);

export type ResetSessionPlayer = {
  id: string;
  name: string;
  position1: string | null;
  importOrder: number | null;
};

export type FixedTailSequenceByRole = Record<PositionGroup, string[]>;

export type ResetRoleOrderingSummary = {
  role: PositionGroup;
  totalPlayers: number;
  shuffledCount: number;
  fixedTailRequested: number;
  fixedTailMatched: number;
  fixedTailMissing: number;
};

export type ResetSessionPlayerOrderResult = {
  orderedPlayers: ResetSessionPlayer[];
  roleSummaries: ResetRoleOrderingSummary[];
  unknownRolePlayers: number;
};

type SequenceEntry = {
  sequence: number;
  rowIndex: number;
  name: string;
};

type ComputeResetOrderOptions = {
  random?: () => number;
};

type BuildResetOrderOptions = ComputeResetOrderOptions & {
  csvFilePath?: string;
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sortPlayersByImportOrder(players: ResetSessionPlayer[]) {
  return [...players].sort((a, b) => {
    const importOrderDiff =
      (a.importOrder ?? Number.MAX_SAFE_INTEGER) -
      (b.importOrder ?? Number.MAX_SAFE_INTEGER);
    if (importOrderDiff !== 0) return importOrderDiff;
    return a.name.localeCompare(b.name);
  });
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (isQuoted && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
      continue;
    }

    if (char === "," && !isQuoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseSequenceCell(
  value: string,
  rowIndex: number,
): SequenceEntry | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d+)\s*\.\s*(.+)$/);
  if (!match) return null;

  const sequence = Number(match[1]);
  const name = match[2]?.trim() ?? "";

  if (!Number.isInteger(sequence) || sequence < 1 || !name) {
    return null;
  }

  return {
    sequence,
    rowIndex,
    name,
  };
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const index = headers.findIndex((header) => header === alias);
    if (index !== -1) return index;
  }

  return -1;
}

function resolveRandomValue(random: () => number, maxExclusive: number) {
  const raw = random();
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw >= 1) return maxExclusive - 1;
  return Math.floor(raw * maxExclusive);
}

function shufflePlayers<T>(players: T[], random: () => number) {
  const shuffled = [...players];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = resolveRandomValue(random, index + 1);
    const temp = shuffled[index];
    shuffled[index] = shuffled[randomIndex];
    shuffled[randomIndex] = temp;
  }

  return shuffled;
}

export function parseFixedTailSequenceCsv(
  csvText: string,
): FixedTailSequenceByRole {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("Player sequence CSV is empty");
  }

  const headerRow = parseCsvLine(lines[0] ?? "").map(normalizeHeader);

  const headerIndexes = {} as Record<PositionGroup, number>;
  const missingColumns: string[] = [];

  for (const role of RESET_POSITION_ORDER) {
    const index = findColumnIndex(headerRow, CSV_HEADER_ALIASES[role]);
    if (index === -1) {
      missingColumns.push(role);
      continue;
    }

    headerIndexes[role] = index;
  }

  if (missingColumns.length > 0) {
    throw new Error(
      `Player sequence CSV is missing required columns: ${missingColumns.join(", ")}`,
    );
  }

  const sequenceEntries: Record<PositionGroup, SequenceEntry[]> = {
    GK: [],
    DEFENCE: [],
    MIDFIELDER: [],
    ATTACKER: [],
  };

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const row = parseCsvLine(lines[lineIndex] ?? "");

    for (const role of RESET_POSITION_ORDER) {
      const columnIndex = headerIndexes[role];
      if (columnIndex >= row.length) continue;

      const parsedCell = parseSequenceCell(row[columnIndex] ?? "", lineIndex);
      if (!parsedCell) continue;
      sequenceEntries[role].push(parsedCell);
    }
  }

  const fixedTailSequence = {} as FixedTailSequenceByRole;
  for (const role of RESET_POSITION_ORDER) {
    fixedTailSequence[role] = sequenceEntries[role]
      .slice()
      .sort(
        (a, b) =>
          a.sequence - b.sequence ||
          a.rowIndex - b.rowIndex ||
          a.name.localeCompare(b.name),
      )
      .map((entry) => entry.name);
  }

  return fixedTailSequence;
}

export async function loadFixedTailSequenceByRole(
  csvFilePath = DEFAULT_CSV_PATH,
) {
  const csvText = await fs.readFile(csvFilePath, "utf8");
  return parseFixedTailSequenceCsv(csvText);
}

export function computeResetSessionPlayerOrder(
  players: ResetSessionPlayer[],
  fixedTailSequenceByRole: FixedTailSequenceByRole,
  options?: ComputeResetOrderOptions,
): ResetSessionPlayerOrderResult {
  const random = options?.random ?? Math.random;
  const sortedPlayers = sortPlayersByImportOrder(players);

  const roleBuckets: Record<PositionGroup, ResetSessionPlayer[]> = {
    GK: [],
    DEFENCE: [],
    MIDFIELDER: [],
    ATTACKER: [],
  };
  const unknownRolePlayers: ResetSessionPlayer[] = [];

  for (const player of sortedPlayers) {
    const role = getPositionGroup(player.position1);
    if (!role) {
      unknownRolePlayers.push(player);
      continue;
    }

    roleBuckets[role].push(player);
  }

  const orderedPlayers: ResetSessionPlayer[] = [];
  const roleSummaries: ResetRoleOrderingSummary[] = [];

  for (const role of RESET_POSITION_ORDER) {
    const rolePlayers = roleBuckets[role];
    const fixedTailNames = fixedTailSequenceByRole[role] ?? [];

    const playersByName = new Map<string, ResetSessionPlayer[]>();
    for (const player of rolePlayers) {
      const key = normalizeName(player.name);
      const bucket = playersByName.get(key);
      if (bucket) {
        bucket.push(player);
      } else {
        playersByName.set(key, [player]);
      }
    }

    const consumedIds = new Set<string>();
    const fixedTailPlayers: ResetSessionPlayer[] = [];
    let fixedTailMissing = 0;

    for (const fixedTailName of fixedTailNames) {
      const key = normalizeName(fixedTailName);
      const bucket = playersByName.get(key);
      const match = bucket?.shift() ?? null;

      if (!match) {
        fixedTailMissing += 1;
        continue;
      }

      consumedIds.add(match.id);
      fixedTailPlayers.push(match);
    }

    const shuffledPool = rolePlayers.filter(
      (player) => !consumedIds.has(player.id),
    );
    const shuffledPlayers = shufflePlayers(shuffledPool, random);

    orderedPlayers.push(...shuffledPlayers, ...fixedTailPlayers);

    roleSummaries.push({
      role,
      totalPlayers: rolePlayers.length,
      shuffledCount: shuffledPlayers.length,
      fixedTailRequested: fixedTailNames.length,
      fixedTailMatched: fixedTailPlayers.length,
      fixedTailMissing,
    });
  }

  orderedPlayers.push(...unknownRolePlayers);

  return {
    orderedPlayers,
    roleSummaries,
    unknownRolePlayers: unknownRolePlayers.length,
  };
}

export async function buildResetSessionPlayerOrder(
  players: ResetSessionPlayer[],
  options?: BuildResetOrderOptions,
) {
  const fixedTailSequenceByRole = await loadFixedTailSequenceByRole(
    options?.csvFilePath,
  );

  return computeResetSessionPlayerOrder(players, fixedTailSequenceByRole, {
    random: options?.random,
  });
}
