import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status");
    const supabase = await getSupabaseServerClient();

    let query = supabase.from("Player").select("*").order("importOrder");

    if (status) {
      query = query.eq("status", status as "UNSOLD" | "SOLD" | "IN_AUCTION");
    }

    const { data: players, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: players });
  } catch (error) {
    logger.error("Failed to fetch players", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch players" },
      { status: 500 },
    );
  }
}
