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
  getGroupNames,
  type BatchDrawResult,
  type GroupName,
  type SingleDrawResult,
  type TdTeam,
  type UndoDrawResult,
} from "@/types/teams-dist";

type GroupPresetRow = { teamId: string; groupName: string };

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
async function getEligibleGroups(
  tournamentId: string,
  numberOfGroups = GROUP_NAMES.length,
  teamsPerGroup = MAX_TEAMS_PER_GROUP
): Promise<GroupName[]> {
  const counts = await getGroupSlotCounts(tournamentId);
  return getGroupNames(numberOfGroups).filter(
    (g) => (counts[g] ?? 0) < teamsPerGroup
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

  const tournament = await tdPrisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
  });
  const [unassigned, eligible, presets] = await Promise.all([
    getUnassignedTeams(tournamentId),
    getEligibleGroups(
      tournamentId,
      tournament.numberOfGroups,
      tournament.teamsPerGroup
    ),
    tdPrisma.tdGroupPreset.findMany({
      where: { tournamentId },
      include: { team: true },
    }),
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
  const preset = presets.find((candidate: GroupPresetRow) =>
    eligible.includes(candidate.groupName) &&
    unassigned.some((candidateTeam: { id: string }) => candidateTeam.id === candidate.teamId)
  );
  if (preset) {
    team = unassigned.find((candidate: { id: string }) => candidate.id === preset.teamId);
    group = preset.groupName;
  } else if (staged) {
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

  const tournament = await tdPrisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
  });
  const [unassigned, eligible, presets] = await Promise.all([
    getUnassignedTeams(tournamentId),
    getEligibleGroups(
      tournamentId,
      tournament.numberOfGroups,
      tournament.teamsPerGroup
    ),
    tdPrisma.tdGroupPreset.findMany({ where: { tournamentId } }),
  ]);

  if (unassigned.length === 0) {
    await setSpinState(tournamentId, false);
    throw new DrawEngineError("No unassigned teams remaining.");
  }
  if (eligible.length === 0) {
    await setSpinState(tournamentId, false);
    throw new DrawEngineError("All groups are full.");
  }

  const stagedEntries = await tdPrisma.tdWatchdogStage.findMany({
    where: { tournamentId, drawMode: "BATCH" },
  });

  const availableTeams = [...unassigned];
  const selections: Array<{ team: (typeof unassigned)[number]; group: GroupName }> = [];
  const consumedStageIds: string[] = [];

  // A batch assigns one distinct team to every currently eligible group.
  // Staged assignments win for their matching group; all remaining choices
  // retain the normal random team selection.
  for (const group of eligible) {
    const preset = presets.find(
      (entry: GroupPresetRow) =>
        entry.groupName === group &&
        availableTeams.some((team: { id: string }) => team.id === entry.teamId)
    );
    const staged = stagedEntries.find(
      (entry: { groupName: string; teamId: string; id: string }) =>
        entry.groupName === group &&
        availableTeams.some((team: { id: string }) => team.id === entry.teamId)
    );
    const selectedTeamId = preset?.teamId ?? staged?.teamId;
    const team = selectedTeamId
      ? availableTeams.find((candidate: { id: string }) => candidate.id === selectedTeamId)
      : undefined;
    const resolvedTeam = team ?? availableTeams[secureRandInt(availableTeams.length)];

    if (!resolvedTeam) break;

    selections.push({ team: resolvedTeam, group });
    availableTeams.splice(availableTeams.indexOf(resolvedTeam), 1);
    if (staged && !preset) consumedStageIds.push(staged.id);
  }

  if (selections.length === 0) {
    await setSpinState(tournamentId, false);
    throw new DrawEngineError("No drawable team/group pairs remain.");
  }

  const payload = selections.map(({ team, group }) => ({
    teamId: team.id,
    teamName: team.name,
    group,
  }));

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

    for (const { team, group } of selections) {
      const slotIndex = await tx.tdGroupAssignment.count({
        where: { tournamentId, groupName: group },
      });

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

    if (consumedStageIds.length > 0) {
      await tx.tdWatchdogStage.deleteMany({
        where: { id: { in: consumedStageIds } },
      });
    }

    await tx.tournament.update({
      where: { id: tournamentId },
      data: { status: "DRAW_IN_PROGRESS" },
    });

    return newAction;
  });

  // Reset spin state after the complete batch finishes.
  await setSpinState(tournamentId, false);

  const remaining = unassigned.length - selections.length;
  if (remaining === 0) {
    await tdPrisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "DRAW_COMPLETE" },
    });
  }

  const teamsWithAssignments = await tdPrisma.tdTeam.findMany({
    where: { id: { in: selections.map(({ team }) => team.id) } },
    include: { groupAssignment: true },
  });

  return {
    mode: "batch",
    assignments: selections.map(({ team, group }) => ({
      team: serializeTeam(
        teamsWithAssignments.find((candidate: { id: string }) => candidate.id === team.id)!
      ),
      group,
    })),
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
