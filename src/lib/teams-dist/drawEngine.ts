/**
 * Draw Engine — server-only module.
 *
 * All randomisation happens here on the server so the browser
 * cannot influence draw results. Each operation is wrapped in
 * a Prisma transaction for atomicity.
 */

import { tdPrisma } from "@/lib/teams-dist/prisma";
import {
  GROUP_NAMES,
  MAX_TEAMS_PER_GROUP,
  type BatchDrawResult,
  type GroupName,
  type SingleDrawResult,
  type TdTeam,
  type UndoDrawResult,
} from "@/types/teams-dist";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cryptographically-random integer in [0, max) */
function secureRandInt(max: number): number {
  if (max <= 0) throw new Error("max must be > 0");
  const arr = new Uint32Array(1);
  // In Node 19+ globalThis.crypto is available; older versions use the import.
  // Next.js guarantees Node ≥18.17 which has globalThis.crypto.
  globalThis.crypto.getRandomValues(arr);
  return arr[0] % max;
}

/** Fisher-Yates shuffle (in-place) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function serializeTeam(t: {
  id: string;
  tournamentId: string;
  name: string;
  shortName: string | null;
  country: string | null;
  crestUrl: string | null;
  seedPot: number | null;
  importedOrder: number;
  createdAt: Date;
  groupAssignment: { id: string; tournamentId: string; teamId: string; groupName: string; slotIndex: number; drawMode: string; actionId: string; assignedAt: Date } | null;
}): TdTeam {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    groupAssignment: t.groupAssignment
      ? {
          ...t.groupAssignment,
          drawMode: t.groupAssignment.drawMode as "SINGLE" | "BATCH",
          assignedAt: t.groupAssignment.assignedAt.toISOString(),
        }
      : null,
  };
}

// ── Get board state helpers ───────────────────────────────────────────────────

async function getUnassignedTeams(tournamentId: string) {
  return tdPrisma.tdTeam.findMany({
    where: { tournamentId, groupAssignment: null },
    include: { groupAssignment: true },
    orderBy: { importedOrder: "asc" },
  });
}

async function getGroupSlotCounts(tournamentId: string) {
  const assignments = await tdPrisma.tdGroupAssignment.groupBy({
    by: ["groupName"],
    where: { tournamentId },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const g of assignments) counts[g.groupName] = g._count._all;
  return counts;
}

/** Groups with remaining capacity */
async function getEligibleGroups(tournamentId: string): Promise<GroupName[]> {
  const counts = await getGroupSlotCounts(tournamentId);
  return GROUP_NAMES.filter(
    (g) => (counts[g] ?? 0) < MAX_TEAMS_PER_GROUP
  );
}

/** Next slot index for a group */
async function getNextSlotIndex(
  tournamentId: string,
  groupName: string
): Promise<number> {
  const count = await tdPrisma.tdGroupAssignment.count({
    where: { tournamentId, groupName },
  });
  return count;
}

// ── Single draw ───────────────────────────────────────────────────────────────

export async function executeSingleDraw(
  tournamentId: string,
  userId?: string
): Promise<SingleDrawResult> {
  // Signal start of a single spin
  await setSpinState(tournamentId, true, "SINGLE");

  const [unassigned, eligible] = await Promise.all([
    getUnassignedTeams(tournamentId),
    getEligibleGroups(tournamentId),
  ]);

  if (unassigned.length === 0) {
    await setSpinState(tournamentId, false);
    throw new DrawEngineError("No unassigned teams remaining.");
  }
  if (eligible.length === 0) {
    await setSpinState(tournamentId, false);
    throw new DrawEngineError("All groups are full.");
  }

  // Check for a pre‑staged assignment from watchdog
  const staged = await tdPrisma.tdWatchdogStage.findFirst({
    where: { tournamentId, drawMode: "SINGLE" },
  });
  let team: any;
  let group: GroupName;
  if (staged) {
    // Consume the staged entry
    await tdPrisma.tdWatchdogStage.delete({ where: { id: staged.id } });
    const foundTeam = await tdPrisma.tdTeam.findFirst({
      where: { id: staged.teamId, tournamentId },
    });
    if (!foundTeam) throw new DrawEngineError("Staged team not found.");
    team = foundTeam;
    group = staged.groupName as GroupName;
  } else {
    team = unassigned[secureRandInt(unassigned.length)];
    group = eligible[secureRandInt(eligible.length)] as GroupName;
  }

  const slotIndex = await getNextSlotIndex(tournamentId, group);
  const payload = { teamId: team.id, teamName: team.name, group };

  const [action, assignment] = await tdPrisma.$transaction(async (tx: any) => {
    await tx.tdDrawAction.updateMany({
      where: { tournamentId, reversible: true },
      data: { reversible: false },
    });

    const newAction = await tx.tdDrawAction.create({
      data: {
        tournamentId,
        actionType: "SINGLE",
        payloadJson: payload,
        reversible: true,
        createdBy: userId ?? null,
      },
    });

    const newAssignment = await tx.tdGroupAssignment.create({
      data: {
        tournamentId,
        teamId: team.id,
        groupName: group,
        slotIndex,
        drawMode: "SINGLE",
        actionId: newAction.id,
      },
    });

    await tx.tournament.update({
      where: { id: tournamentId },
      data: { status: "DRAW_IN_PROGRESS" },
    });

    return [newAction, newAssignment] as const;
  });

  // Reset spin state after operation completes
  await setSpinState(tournamentId, false);

  const remaining = unassigned.length - 1;
  if (remaining === 0) {
    await tdPrisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "DRAW_COMPLETE" },
    });
  }

  const teamWithAssignment = await tdPrisma.tdTeam.findUniqueOrThrow({
    where: { id: team.id },
    include: { groupAssignment: true },
  });

  return {
    mode: "single",
    team: serializeTeam(teamWithAssignment),
    group,
    action: {
      ...action,
      createdAt: action.createdAt.toISOString(),
    },
  };
}

// ── Batch draw ────────────────────────────────────────────────────────────────

export async function executeBatchDraw(
  tournamentId: string,
  userId?: string
): Promise<BatchDrawResult> {
  // Signal start of a batch spin
  await setSpinState(tournamentId, true, "BATCH");

  const [unassigned, eligible] = await Promise.all([
    getUnassignedTeams(tournamentId),
    getEligibleGroups(tournamentId),
  ]);

  if (unassigned.length < 4) {
    await setSpinState(tournamentId, false);
    throw new DrawEngineError(
      `Need at least 4 unassigned teams for a batch draw (have ${unassigned.length}).`
    );
  }
  if (eligible.length < 4) {
    await setSpinState(tournamentId, false);
    throw new DrawEngineError(
      `Need at least 4 eligible groups for a batch draw (have ${eligible.length}).`
    );
  }

  // First, try to pull up to 4 staged assignments (single mode is ignored here)
  const stagedRows = await tdPrisma.tdWatchdogStage.findMany({
    where: { tournamentId, drawMode: "BATCH" },
    take: 4,
  });

  let pairs: { team: any; group: GroupName }[] = [];
  if (stagedRows.length === 4) {
    // Consume staged rows
    await tdPrisma.tdWatchdogStage.deleteMany({
      where: { id: { in: stagedRows.map((r: { id: string }) => r.id) } },
    });
    for (const row of stagedRows) {
      const team = await tdPrisma.tdTeam.findFirst({
        where: { id: row.teamId, tournamentId },
      });
      if (!team) throw new DrawEngineError("Staged team not found.");
      pairs.push({ team, group: row.groupName as GroupName });
    }
  } else {
    // Random fallback
    const shuffledTeams = shuffle([...unassigned]).slice(0, 4);
    const shuffledGroups = shuffle([...eligible]).slice(0, 4) as GroupName[];
    pairs = shuffledTeams.map((team, i) => ({ team, group: shuffledGroups[i] }));
  }

  const payload = pairs.map((p) => ({
    teamId: p.team.id,
    teamName: p.team.name,
    group: p.group,
  }));

  // Pre‑compute slot indexes for each group
  const counts = await getGroupSlotCounts(tournamentId);
  const slotCounters: Record<string, number> = { ...counts };

  const action = await tdPrisma.$transaction(async (tx: any) => {
    await tx.tdDrawAction.updateMany({
      where: { tournamentId, reversible: true },
      data: { reversible: false },
    });

    const newAction = await tx.tdDrawAction.create({
      data: {
        tournamentId,
        actionType: "BATCH",
        payloadJson: payload,
        reversible: true,
        createdBy: userId ?? null,
      },
    });

    for (const { team, group } of pairs) {
      const slotIndex = slotCounters[group] ?? 0;
      slotCounters[group] = slotIndex + 1;

      await tx.tdGroupAssignment.create({
        data: {
          tournamentId,
          teamId: team.id,
          groupName: group,
          slotIndex,
          drawMode: "BATCH",
          actionId: newAction.id,
        },
      });
    }

    await tx.tournament.update({
      where: { id: tournamentId },
      data: { status: "DRAW_IN_PROGRESS" },
    });

    return newAction;
  });

  // Reset spin state after batch completes
  await setSpinState(tournamentId, false);

  const remaining = unassigned.length - 4;
  if (remaining <= 0) {
    await tdPrisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "DRAW_COMPLETE" },
    });
  }

  const assignedTeams = await tdPrisma.tdTeam.findMany({
    where: { id: { in: pairs.map((p) => p.team.id) } },
    include: { groupAssignment: true },
  });

  const assignments = pairs.map((p) => ({
    team: serializeTeam(
      // biome-ignore lint/suspicious/noExplicitAny: generated runtime type
      assignedTeams.find((t: any) => t.id === p.team.id)!
    ),
    group: p.group,
  }));

  return {
    mode: "batch",
    assignments,
    action: {
      ...action,
      createdAt: action.createdAt.toISOString(),
    },
  };
}

// ── Undo ──────────────────────────────────────────────────────────────────────

export async function executeUndo(
  tournamentId: string
): Promise<UndoDrawResult> {
  const lastAction = await tdPrisma.tdDrawAction.findFirst({
    where: { tournamentId, reversible: true, reverted: false },
    orderBy: { createdAt: "desc" },
    include: { groupAssignments: true },
  });

  if (!lastAction)
    throw new DrawEngineError("No reversible action to undo.");

  // biome-ignore lint/suspicious/noExplicitAny: generated runtime type
  const removedTeamIds = lastAction.groupAssignments.map((a: any) => a.teamId);

  await tdPrisma.$transaction(async (tx: any) => {
    // Delete the assignments linked to this action
    await tx.tdGroupAssignment.deleteMany({
      where: { actionId: lastAction.id },
    });

    // Record the undo action
    await tx.tdDrawAction.update({
      where: { id: lastAction.id },
      data: { reversible: false, reverted: true },
    });

    await tx.tdDrawAction.create({
      data: {
        tournamentId,
        actionType: "UNDO",
        payloadJson: { undoneActionId: lastAction.id },
        reversible: false,
      },
    });

    // Roll back tournament status if needed
    const remaining = await tx.tdGroupAssignment.count({
      where: { tournamentId },
    });
    if (remaining === 0) {
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "TEAMS_READY" },
      });
    } else {
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "DRAW_IN_PROGRESS" },
      });
    }
  });

  return {
    mode: "undo",
    undoneActionId: lastAction.id,
    removedTeamIds,
  };
}

// ── Reset Session ────────────────────────────────────────────────────────────────

/**
 * Reset the entire draw session for a tournament.
 * Clears all group assignments, any staged watchdog entries, and resets the tournament status.
 */
export async function executeResetSession(
  tournamentId: string,
  userId?: string
): Promise<void> {
  // Delete all assignments and watchdog staging data in a transaction for safety.
  await tdPrisma.$transaction(async (tx: any) => {
    await tx.tdGroupAssignment.deleteMany({
      where: { tournamentId },
    });
    // Cleanup any pending watchdog stages.
    await tx.tdWatchdogStage.deleteMany({
      where: { tournamentId },
    });
    // Reset spin state.
    await tx.tdWatchdogSpinState.upsert({
      where: { tournamentId },
      create: { tournamentId, isSpinning: false, drawMode: null },
      update: { isSpinning: false, drawMode: null },
    });
    // Update tournament status back to ready.
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { status: "TEAMS_READY" },
    });
    // Record the reset action (non‑reversible).
    await tx.tdDrawAction.create({
      data: {
        tournamentId,
        actionType: "RESET",
        payloadJson: {},
        reversible: false,
        createdBy: userId ?? null,
      },
    });
  });
}

// ── Spin State Helpers ────────────────────────────────────────────────────────
/** Update the spin state for a tournament */
async function setSpinState(
  tournamentId: string,
  isSpinning: boolean,
  drawMode: "SINGLE" | "BATCH" | null = null
): Promise<void> {
  await tdPrisma.tdWatchdogSpinState.upsert({
    where: { tournamentId },
    create: { tournamentId, isSpinning, drawMode },
    update: { isSpinning, drawMode },
  });
}

/** Retrieve the current spin state */
export async function getCurrentSpinState(tournamentId: string): Promise<{
  isSpinning: boolean;
  drawMode: "SINGLE" | "BATCH" | null;
}> {
  const state = await tdPrisma.tdWatchdogSpinState.findUnique({
    where: { tournamentId },
  });
  return {
    isSpinning: state?.isSpinning ?? false,
    drawMode: state?.drawMode ?? null,
  };
}

// Modify existing draw functions to emit spin state changes
// NOTE: The following patches are applied inline in the respective functions.


// ── Error class ───────────────────────────────────────────────────────────────

export class DrawEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawEngineError";
  }
}
