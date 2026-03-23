import { NextResponse } from "next/server";
import { MOCK_PLAYERS } from "@/app/api/_mockData";

export async function GET() {
  const current = MOCK_PLAYERS.find((p) => p.status === "IN_AUCTION") ?? null;
  return NextResponse.json({ success: true, data: current });
}
