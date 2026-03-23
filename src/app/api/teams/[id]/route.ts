import { NextResponse } from "next/server";
import { MOCK_TEAMS, MOCK_PLAYERS } from "@/app/api/_mockData";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const team = MOCK_TEAMS.find((t) => t.id === id || t.slug === id);
  if (!team)
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 },
    );

  const players = MOCK_PLAYERS.filter((p) => p.teamId === team.id);
  return NextResponse.json({
    success: true,
    data: {
      ...team,
      pointsRemaining: team.pointsTotal - team.pointsSpent,
      playersOwnedCount: players.length,
      players,
      transactions: [],
    },
  });
}
