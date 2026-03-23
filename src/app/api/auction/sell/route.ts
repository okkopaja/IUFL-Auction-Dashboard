import { NextResponse } from "next/server";
import { MOCK_TRANSACTIONS } from "@/app/api/_mockData";

export async function POST() {
  // Dummy sell — always succeeds with a mock response
  return NextResponse.json({
    success: true,
    data: {
      transaction: MOCK_TRANSACTIONS[0] ?? {
        id: "tx_dummy",
        playerId: "p16",
        teamId: "t01",
        amount: 100,
      },
      nextPlayer: { id: "p17", name: "Florian Wirtz", basePrice: 110 },
    },
  });
}
