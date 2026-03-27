import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();

    const { data: current, error } = await supabase
      .from("Player")
      .select("*")
      .eq("status", "IN_AUCTION")
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ success: true, data: current });
  } catch (error) {
    logger.error("Failed to fetch current player", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch current player" },
      { status: 500 },
    );
  }
}
