import type { Player } from "@/types";

export type PositionGroup = "GK" | "DEFENCE" | "MIDFIELDER" | "ATTACKER";

const POSITION_GROUP_ORDER: PositionGroup[] = [
  "GK",
  "DEFENCE",
  "MIDFIELDER",
  "ATTACKER",
];

const POSITION_GROUP_ALIASES: Record<PositionGroup, string[]> = {
  GK: ["GK", "GOAL KEEPER", "GOALKEEPER"],
  DEFENCE: ["DEF", "DEFENCE", "DEFENDER", "DEFENDERS", "DEFENSE"],
  MIDFIELDER: ["MID", "MIDFIELD", "MIDFIELDER", "MIDFIELDERS"],
  ATTACKER: [
    "ATT",
    "ATTACKER",
    "ATTACKERS",
    "FWD",
    "FORWARD",
    "FORWARDS",
    "ST",
    "STRIKER",
    "STRIKERS",
  ],
};

const POSITION_GROUP_LOOKUP = new Map<string, PositionGroup>();
for (const [group, aliases] of Object.entries(POSITION_GROUP_ALIASES)) {
  for (const alias of aliases) {
    POSITION_GROUP_LOOKUP.set(alias, group as PositionGroup);
  }
}

const POSITION_GROUP_PRIORITY = new Map<PositionGroup, number>(
  POSITION_GROUP_ORDER.map((group, index) => [group, index]),
);

function normalizePosition(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function getPositionGroup(
  position1: string | null | undefined,
): PositionGroup | null {
  const normalized = normalizePosition(position1);
  if (!normalized) return null;
  return POSITION_GROUP_LOOKUP.get(normalized) ?? null;
}

type AuctionSortablePlayer = Pick<Player, "position1" | "importOrder" | "name">;

function getAuctionPositionPriority(
  position1: string | null | undefined,
): number {
  const group = getPositionGroup(position1);
  if (!group) return POSITION_GROUP_ORDER.length;
  return POSITION_GROUP_PRIORITY.get(group) ?? POSITION_GROUP_ORDER.length;
}

export function comparePlayersByAuctionOrder(
  a: AuctionSortablePlayer,
  b: AuctionSortablePlayer,
): number {
  const positionDiff =
    getAuctionPositionPriority(a.position1) -
    getAuctionPositionPriority(b.position1);
  if (positionDiff !== 0) return positionDiff;

  const importOrderDiff =
    (a.importOrder ?? Number.MAX_SAFE_INTEGER) -
    (b.importOrder ?? Number.MAX_SAFE_INTEGER);
  if (importOrderDiff !== 0) return importOrderDiff;

  return a.name.localeCompare(b.name);
}

export function sortPlayersByAuctionOrder<T extends AuctionSortablePlayer>(
  players: T[],
): T[] {
  return [...players].sort(comparePlayersByAuctionOrder);
}

export function filterPlayersByPositionGroup(
  players: Player[],
  group: PositionGroup,
): Player[] {
  return players.filter(
    (player) => getPositionGroup(player.position1) === group,
  );
}

export function filterPlayersBySearch(
  players: Player[],
  query: string,
): Player[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return players;

  return players.filter(
    (player) =>
      player.name.toLowerCase().includes(normalizedQuery) ||
      player.position1?.toLowerCase().includes(normalizedQuery) ||
      player.position2?.toLowerCase().includes(normalizedQuery) ||
      player.year?.toLowerCase().includes(normalizedQuery) ||
      player.stream?.toLowerCase().includes(normalizedQuery) ||
      player.team?.shortCode?.toLowerCase().includes(normalizedQuery) ||
      player.team?.name?.toLowerCase().includes(normalizedQuery),
  );
}
