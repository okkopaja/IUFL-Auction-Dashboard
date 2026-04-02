import { type NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";

export async function POST(_req: NextRequest) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  return NextResponse.json(
    {
      success: false,
      error:
        "Legacy endpoint disabled. Use /api/admin/player-import/check then /api/admin/player-import/commit.",
    },
    { status: 410 },
  );
}
