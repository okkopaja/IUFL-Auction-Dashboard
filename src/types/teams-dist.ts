/**
 * Shared TypeScript types for the Teams Distribution feature.
 * These mirror the Prisma schema enums and model shapes
 * but are safe to import in both server and client code.
 */

export type TournamentStatus =
  | "SETUP"
  | "TEAMS_READY"
  | "DRAW_IN_PROGRESS"
  | "DRAW_COMPLETE";

export type DrawMode = "SINGLE" | "BATCH";
export type DrawActionType = "SINGLE" | "BATCH" | "UNDO" | "RESET";

// ── Serialisable shapes returned by the API ──────────────────────────────────

export interface TdTournament {
  id: string;
  name: string;
  formatType: string;
  totalTeams: number;
  status: TournamentStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Extra counts joined by the API */
  teamCount?: number;
  assignedCount?: number;
}

export interface TdTeam {
  id: string;
  tournamentId: string;
  name: string;
  shortName: string | null;
  country: string | null;
  crestUrl: string | null;
  seedPot: number | null;
  importedOrder: number;
  createdAt: string;
  /** Present when the team has been assigned */
  groupAssignment?: TdGroupAssignment | null;
}

export interface TdGroupAssignment {
  id: string;
  tournamentId: string;
  teamId: string;
  groupName: string;
  slotIndex: number;
  drawMode: DrawMode;
  actionId: string;
  assignedAt: string;
}

export interface TdDrawAction {
  id: string;
  tournamentId: string;
  actionType: DrawActionType;
  payloadJson: unknown;
  reversible: boolean;
  reverted: boolean;
  createdAt: string;
  createdBy: string | null;
}

// ── Group board helper ────────────────────────────────────────────────────────

export type GroupName = "A" | "B" | "C" | "D";
export const GROUP_NAMES: GroupName[] = ["A", "B", "C", "D"];
export const MAX_TEAMS_PER_GROUP = 4;

export interface GroupSlot {
  groupName: GroupName;
  teams: TdTeam[];
  isFull: boolean;
  capacity: number;
}

// ── Draw API payloads ─────────────────────────────────────────────────────────

export type DrawRequest =
  | { mode: "single" }
  | { mode: "batch" }
  | { mode: "undo" }
  | { mode: "reset" };

export interface SingleDrawResult {
  mode: "single";
  team: TdTeam;
  group: GroupName;
  action: TdDrawAction;
}

export interface BatchDrawResult {
  mode: "batch";
  assignments: Array<{ team: TdTeam; group: GroupName }>;
  action: TdDrawAction;
}

export interface UndoDrawResult {
  mode: "undo";
  undoneActionId: string;
  removedTeamIds: string[];
}

export interface ResetDrawResult {
  mode: "reset";
  removedCount: number;
}

export type DrawResult = SingleDrawResult | BatchDrawResult | UndoDrawResult | ResetDrawResult;

// ── CSV import ────────────────────────────────────────────────────────────────

export interface TeamCsvRow {
  team_name: string;
  short_name?: string;
  country?: string;
  seed_pot?: string;
  crest_url?: string;
}
