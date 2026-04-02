import { sortPlayersByAuctionOrder } from "@/lib/playerFilters";
import type { getSupabaseAdminClient } from "@/lib/supabase";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>;

type ProgressionPlayer = {
  id: string;
  name: string;
  position1: string;
  importOrder: number;
  status: "UNSOLD" | "IN_AUCTION" | "SOLD";
};

function findNextUnsoldPlayer(players: ProgressionPlayer[]) {
  const orderedPlayers = sortPlayersByAuctionOrder(players);

  if (orderedPlayers.length === 0) {
    return null;
  }

  const currentInAuction = orderedPlayers.find(
    (player) => player.status === "IN_AUCTION",
  );

  if (!currentInAuction) {
    return orderedPlayers.find((player) => player.status === "UNSOLD") ?? null;
  }

  const currentIndex = orderedPlayers.findIndex(
    (player) => player.id === currentInAuction.id,
  );

  for (let offset = 1; offset <= orderedPlayers.length; offset += 1) {
    const candidate =
      orderedPlayers[(currentIndex + offset) % orderedPlayers.length];
    if (candidate.status === "UNSOLD") {
      return candidate;
    }
  }

  return null;
}

export async function advanceToNextPlayer(
  supabase: SupabaseAdminClient,
  sessionId: string,
) {
  const { data: activePlayers, error: activePlayersError } = await supabase
    .from("Player")
    .select("id,name,position1,importOrder,status")
    .eq("sessionId", sessionId)
    .in("status", ["UNSOLD", "IN_AUCTION"])
    .order("importOrder");

  if (activePlayersError) throw activePlayersError;

  const nextUnsold = findNextUnsoldPlayer(
    (activePlayers ?? []) as ProgressionPlayer[],
  );

  const { error: resetError } = await supabase
    .from("Player")
    .update({ status: "UNSOLD" })
    .eq("sessionId", sessionId)
    .eq("status", "IN_AUCTION");

  if (resetError) throw resetError;

  if (!nextUnsold) {
    return null;
  }

  const { error: setError } = await supabase
    .from("Player")
    .update({ status: "IN_AUCTION" })
    .eq("sessionId", sessionId)
    .eq("id", nextUnsold.id);

  if (setError) throw setError;

  return {
    ...nextUnsold,
    status: "IN_AUCTION" as const,
  };
}
