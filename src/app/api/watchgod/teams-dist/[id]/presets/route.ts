import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { tdPrisma } from "@/lib/teams-dist/prisma";
import { getGroupNames } from "@/types/teams-dist";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function getTournament(tournamentId: string) {
  return tdPrisma.tournament.findUnique({ where: { id: tournamentId } });
}

function canEdit(status: string) {
  return status === "SETUP" || status === "TEAMS_READY";
}

export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const { id: tournamentId } = await params;
    const tournament = await getTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json({ success: false, error: "Tournament not found" }, { status: 404 });
    }

    const presets = await tdPrisma.tdGroupPreset.findMany({
      where: { tournamentId },
      include: { team: true },
      orderBy: { createdAt: "asc" },
    });
    const groups = getGroupNames(tournament.numberOfGroups).map((groupName) => ({
      groupName,
      capacity: tournament.teamsPerGroup,
      teams: presets
        .filter((preset: { groupName: string }) => preset.groupName === groupName)
        .map((preset: { team: { id: string; name: string } }) => ({
          id: preset.team.id,
          name: preset.team.name,
        })),
    }));

    return NextResponse.json({
      success: true,
      data: { groups, editable: canEdit(tournament.status) },
    });
  } catch (error) {
    logger.error("Failed to fetch group presets", error);
    return NextResponse.json({ success: false, error: "Failed to fetch group presets" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const { id: tournamentId } = await params;
    const { teamId, groupName } = await req.json();
    const tournament = await getTournament(tournamentId);

    if (!tournament) {
      return NextResponse.json({ success: false, error: "Tournament not found" }, { status: 404 });
    }
    if (!canEdit(tournament.status)) {
      return NextResponse.json({ success: false, error: "Presets are locked once drawing starts" }, { status: 409 });
    }

    const validGroups = getGroupNames(tournament.numberOfGroups);
    if (typeof teamId !== "string" || !validGroups.includes(groupName)) {
      return NextResponse.json({ success: false, error: "A valid teamId and groupName are required" }, { status: 400 });
    }

    const team = await tdPrisma.tdTeam.findFirst({
      where: { id: teamId, tournamentId },
      include: { groupAssignment: true },
    });
    if (!team) return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
    if (team.groupAssignment) {
      return NextResponse.json({ success: false, error: "Assigned teams cannot be preset" }, { status: 409 });
    }

    const existingInGroup = await tdPrisma.tdGroupPreset.count({
      where: { tournamentId, groupName },
    });
    const existingForTeam = await tdPrisma.tdGroupPreset.findUnique({ where: { teamId } });
    if (!existingForTeam && existingInGroup >= tournament.teamsPerGroup) {
      return NextResponse.json({ success: false, error: `Group ${groupName} is full` }, { status: 409 });
    }

    const preset = await tdPrisma.tdGroupPreset.upsert({
      where: { teamId },
      create: { tournamentId, teamId, groupName },
      update: { groupName },
      include: { team: true },
    });
    return NextResponse.json({ success: true, data: { id: preset.id, teamId, groupName, teamName: preset.team.name } });
  } catch (error) {
    logger.error("Failed to save group preset", error);
    return NextResponse.json({ success: false, error: "Failed to save group preset" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const { id: tournamentId } = await params;
    const tournament = await getTournament(tournamentId);
    if (!tournament) return NextResponse.json({ success: false, error: "Tournament not found" }, { status: 404 });
    if (!canEdit(tournament.status)) {
      return NextResponse.json({ success: false, error: "Presets are locked once drawing starts" }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    await tdPrisma.tdGroupPreset.deleteMany({
      where: { tournamentId, ...(body.teamId ? { teamId: body.teamId } : {}) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to delete group preset", error);
    return NextResponse.json({ success: false, error: "Failed to delete group preset" }, { status: 500 });
  }
}