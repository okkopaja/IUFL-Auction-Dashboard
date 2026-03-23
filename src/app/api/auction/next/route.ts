import { NextResponse } from "next/server";
import { MOCK_PLAYERS } from "@/app/api/_mockData";

export async function POST() {
  const nextUnsold = MOCK_PLAYERS.find((p) => p.status === "UNSOLD") ?? null;
  return NextResponse.json({
    success: true,
    data: { nextPlayer: nextUnsold },
  });
}
