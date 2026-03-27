import { type NextRequest, NextResponse } from "next/server";
import { importCommitPayloadSchema } from "@/features/player-import/schema";
import { requireAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  // ── Auth guard (admin only) ──────────────────────────────────────────────
  const denied = await requireAdmin();
  if (denied) return denied;
  // ────────────────────────────────────────────────────────────────────────

  try {
    const body = await req.json();

    // Server-side validation
    const parseResult = importCommitPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { rows } = parseResult.data;
    const supabase = getSupabaseAdminClient();

    // 1. Resolve active session
    const { data: session, error: sessionError } = await supabase
      .from("AuctionSession")
      .select("id")
      .eq("isActive", true)
      .limit(1)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No active auction session found" },
        { status: 404 },
      );
    }

    const sessionId = session.id;

    // 2. Count existing data for response metadata
    const [{ count: existingPlayersCount }, { count: existingTxCount }] =
      await Promise.all([
        supabase
          .from("Player")
          .select("id", { count: "exact", head: true })
          .eq("sessionId", sessionId),
        supabase
          .from("Transaction")
          .select("id", { count: "exact", head: true })
          .eq("sessionId", sessionId),
      ]);

    // 3. Atomic replace via sequential operations using service role (bypasses RLS)
    //    Supabase JS doesn't support multi-statement transactions directly;
    //    we use ordered operations that are safe given the foreign key structure.

    // 3a. Delete all transactions for this session first (FK dependency)
    const { error: deleteTxError } = await supabase
      .from("Transaction")
      .delete()
      .eq("sessionId", sessionId);
    if (deleteTxError) throw deleteTxError;

    // 3b. Reset all team pointsSpent to 0 for this session
    const { error: resetTeamsError } = await supabase
      .from("Team")
      .update({ pointsSpent: 0 })
      .eq("sessionId", sessionId);
    if (resetTeamsError) throw resetTeamsError;

    // 3c. Delete all players for this session
    const { error: deletePlayersError } = await supabase
      .from("Player")
      .delete()
      .eq("sessionId", sessionId);
    if (deletePlayersError) throw deletePlayersError;

    // 3d. Insert imported players
    const now = new Date().toISOString();
    const inserts = rows.map((row) => ({
      id: crypto.randomUUID(),
      sessionId,
      name: row.name,
      year: row.year,
      whatsappNumber: row.whatsappNumber,
      stream: row.stream,
      position1: row.position1,
      position2: row.position2 ?? null,
      importOrder: row.importOrder,
      status: "UNSOLD" as const,
      teamId: null,
      imageUrl: null,
      basePrice: 50,
      createdAt: now,
      updatedAt: now,
    }));

    const { error: insertError } = await supabase
      .from("Player")
      .insert(inserts);
    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      data: {
        importedCount: rows.length,
        removedPlayersCount: existingPlayersCount ?? 0,
        removedTransactionsCount: existingTxCount ?? 0,
        sessionId,
      },
    });
  } catch (error) {
    logger.error("Failed to import players", error);
    return NextResponse.json(
      { success: false, error: "Failed to import players" },
      { status: 500 },
    );
  }
}
