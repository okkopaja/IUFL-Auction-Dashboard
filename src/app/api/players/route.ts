import { NextRequest, NextResponse } from "next/server";
import { MOCK_PLAYERS } from "@/app/api/_mockData";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const players = status
    ? MOCK_PLAYERS.filter((p) => p.status === status)
    : MOCK_PLAYERS;
  return NextResponse.json({ success: true, data: players });
}
