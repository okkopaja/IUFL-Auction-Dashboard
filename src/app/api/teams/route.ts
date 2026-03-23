import { NextResponse } from "next/server";
import { MOCK_TEAMS, MOCK_PLAYERS } from "@/app/api/_mockData";

export async function GET() {
  const teams = MOCK_TEAMS.map((t) => {
    const players = MOCK_PLAYERS.filter((p) => p.teamId === t.id);
    return {
      ...t,
      pointsRemaining: t.pointsTotal - t.pointsSpent,
      playersOwnedCount: players.length,
      players,
      transactions: [],
    };
  });
  return NextResponse.json({ success: true, data: teams });
}
