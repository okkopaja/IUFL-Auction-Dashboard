import { comparePlayersByAuctionOrder } from "@/lib/playerFilters";

export type TeamWiseExportPlayerStatus = "UNSOLD" | "SOLD" | "IN_AUCTION";

export interface TeamWiseExportTeam {
  id: string;
  name: string;
}

export interface TeamWiseExportPlayer {
  id: string;
  name: string;
  status: TeamWiseExportPlayerStatus;
  teamId: string | null;
  position1: string | null;
  importOrder: number | null;
}

export interface TeamWiseExportColumn {
  header: string;
  players: string[];
  count: number;
}

export interface TeamWiseExportSummary {
  teamColumns: number;
  totalColumns: number;
  teamAssignedPlayers: number;
  unsoldPlayers: number;
  absenteePlayers: number;
}

export interface TeamWiseExportData {
  headers: string[];
  rows: string[][];
  columns: TeamWiseExportColumn[];
  rowCount: number;
  summary: TeamWiseExportSummary;
  generatedAt: string;
  suggestedFileName: string;
}

interface BuildTeamWiseExportInput {
  teams: TeamWiseExportTeam[];
  players: TeamWiseExportPlayer[];
  absenteeNames: readonly string[];
  generatedAt?: Date;
}

type SortableByAuctionOrder = {
  name: string;
  position1?: string | null;
  importOrder?: number | null;
};

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function buildSuggestedFileName(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `team-wise-players-${year}${month}${day}-${hours}${minutes}${seconds}.csv`;
}

function sortByAuctionOrder<T extends SortableByAuctionOrder>(rows: T[]): T[] {
  return [...rows].sort((left, right) =>
    comparePlayersByAuctionOrder(
      {
        name: left.name,
        position1: left.position1 ?? "",
        importOrder: left.importOrder ?? undefined,
      },
      {
        name: right.name,
        position1: right.position1 ?? "",
        importOrder: right.importOrder ?? undefined,
      },
    ),
  );
}

function buildAbsenteeList(
  absenteeNames: readonly string[],
  players: TeamWiseExportPlayer[],
): string[] {
  const uniqueAbsentees: Array<SortableByAuctionOrder> = [];
  const seen = new Set<string>();

  const playersByNormalizedName = new Map<string, TeamWiseExportPlayer[]>();

  for (const player of players) {
    const normalized = normalizeName(player.name);
    if (!normalized) continue;

    const existing = playersByNormalizedName.get(normalized) ?? [];
    existing.push(player);
    playersByNormalizedName.set(normalized, existing);
  }

  for (const rawName of absenteeNames) {
    const cleanedName = collapseWhitespace(rawName);
    if (!cleanedName) continue;

    const normalized = normalizeName(cleanedName);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const matchingPlayers = playersByNormalizedName.get(normalized) ?? [];
    const bestMatch = sortByAuctionOrder(matchingPlayers)[0];

    uniqueAbsentees.push({
      name: cleanedName,
      position1: bestMatch?.position1,
      importOrder: bestMatch?.importOrder,
    });
  }

  return sortByAuctionOrder(uniqueAbsentees).map((entry) => entry.name);
}

export function buildTeamWiseExport({
  teams,
  players,
  absenteeNames,
  generatedAt = new Date(),
}: BuildTeamWiseExportInput): TeamWiseExportData {
  const sanitizedTeams = teams
    .map((team) => ({
      id: team.id,
      name: collapseWhitespace(team.name) || team.id,
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );

  const teamPlayerBuckets = new Map<string, TeamWiseExportPlayer[]>();
  for (const team of sanitizedTeams) {
    teamPlayerBuckets.set(team.id, []);
  }

  const normalizedAbsenteeSet = new Set(
    absenteeNames
      .map((name) => normalizeName(name))
      .filter((normalized) => normalized.length > 0),
  );

  const unsoldBucket: TeamWiseExportPlayer[] = [];

  for (const player of players) {
    const cleanedName = collapseWhitespace(player.name);
    if (!cleanedName) continue;

    const normalizedPlayerName = normalizeName(cleanedName);
    const hasMatchingAbsentee = normalizedAbsenteeSet.has(normalizedPlayerName);

    const normalizedPlayer: TeamWiseExportPlayer = {
      ...player,
      name: cleanedName,
    };

    const hasKnownTeam =
      normalizedPlayer.teamId !== null &&
      teamPlayerBuckets.has(normalizedPlayer.teamId);

    if (normalizedPlayer.status === "SOLD" && hasKnownTeam) {
      teamPlayerBuckets
        .get(normalizedPlayer.teamId as string)
        ?.push(normalizedPlayer);
      continue;
    }

    // Absentee membership takes priority over UNSOLD/IN_AUCTION.
    if (hasMatchingAbsentee) {
      continue;
    }

    unsoldBucket.push(normalizedPlayer);
  }

  const teamColumns: TeamWiseExportColumn[] = sanitizedTeams.map((team) => {
    const sortedPlayers = sortByAuctionOrder(
      teamPlayerBuckets.get(team.id) ?? [],
    );
    const names = sortedPlayers.map((player) => player.name);

    return {
      header: team.name,
      players: names,
      count: names.length,
    };
  });

  const unsoldPlayers = sortByAuctionOrder(unsoldBucket).map(
    (player) => player.name,
  );
  const absenteePlayers = buildAbsenteeList(absenteeNames, players);

  const columns: TeamWiseExportColumn[] = [
    ...teamColumns,
    {
      header: "Unsold",
      players: unsoldPlayers,
      count: unsoldPlayers.length,
    },
    {
      header: "Absentee",
      players: absenteePlayers,
      count: absenteePlayers.length,
    },
  ];

  const headers = columns.map((column) => column.header);
  const rowCount = Math.max(
    0,
    ...columns.map((column) => column.players.length),
  );

  const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
    columns.map((column) => column.players[rowIndex] ?? ""),
  );

  return {
    headers,
    rows,
    columns,
    rowCount,
    summary: {
      teamColumns: teamColumns.length,
      totalColumns: columns.length,
      teamAssignedPlayers: teamColumns.reduce(
        (accumulator, column) => accumulator + column.players.length,
        0,
      ),
      unsoldPlayers: unsoldPlayers.length,
      absenteePlayers: absenteePlayers.length,
    },
    generatedAt: generatedAt.toISOString(),
    suggestedFileName: buildSuggestedFileName(generatedAt),
  };
}
