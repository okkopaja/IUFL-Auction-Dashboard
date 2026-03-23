import { NextResponse } from "next/server";
import { MOCK_PLAYERS, MOCK_TRANSACTIONS } from "@/app/api/_mockData";

export async function GET() {
  const soldCount = MOCK_PLAYERS.filter((p) => p.status === "SOLD").length;
  const unsoldCount = MOCK_PLAYERS.filter(
    (p) => p.status === "UNSOLD" || p.status === "IN_AUCTION",
  ).length;
  const totalSpent = MOCK_TRANSACTIONS.reduce((sum, t) => sum + t.amount, 0);
  const totalTeams = 16;

  return NextResponse.json({
    success: true,
    data: { soldCount, unsoldCount, totalSpent, totalTeams },
  });
}
