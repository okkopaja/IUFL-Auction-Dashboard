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

export type AuctionEndReason = "UNSOLD_DEPLETED" | "ITERATION_LIMIT_REACHED";

type SessionProgressionState = {
  id: string;
  unsoldIterationRound: number | null;
  unsoldIterationAnchorPlayerId: string | null;
  restartAckRequired: boolean | null;
  isAuctionEnded: boolean | null;
  auctionEndReason: AuctionEndReason | null;
};

export type AuctionProgressionResult = {
  nextPlayer: ProgressionPlayer | null;
  didWrap: boolean;
  restartedFromAnchor: boolean;
  restartAckRequired: boolean;
  auctionEnded: boolean;
  endReason: AuctionEndReason | null;
  currentRound: number;
};

type NextUnsoldResult = {
  player: ProgressionPlayer | null;
  didWrap: boolean;
};

function normalizeRound(round: number | null | undefined) {
  return round && Number.isInteger(round) && round > 0 ? round : 1;
}

function findFirstUnsoldPlayer(players: ProgressionPlayer[]) {
  return players.find((player) => player.status === "UNSOLD") ?? null;
}

function findNextUnsoldPlayer(
  players: ProgressionPlayer[],
  referenceIndex: number,
): NextUnsoldResult {
  const orderedPlayers = sortPlayersByAuctionOrder(players);

  if (orderedPlayers.length === 0) {
    return {
      player: null,
      didWrap: false,
    };
  }

  const unsoldExists = orderedPlayers.some(
    (player) => player.status === "UNSOLD",
  );
  if (!unsoldExists) {
    return {
      player: null,
      didWrap: false,
    };
  }

  if (referenceIndex < 0 || referenceIndex >= orderedPlayers.length) {
    return {
      player: findFirstUnsoldPlayer(orderedPlayers),
      didWrap: false,
    };
  }

  for (let offset = 1; offset <= orderedPlayers.length; offset += 1) {
    const candidate =
      orderedPlayers[(referenceIndex + offset) % orderedPlayers.length];
    if (candidate.status === "UNSOLD") {
      return {
        player: candidate,
        didWrap: referenceIndex + offset >= orderedPlayers.length,
      };
    }
  }

  return {
    player: null,
    didWrap: false,
  };
}

function findRestartTarget(
  players: ProgressionPlayer[],
  anchorPlayerId: string | null,
) {
  const orderedPlayers = sortPlayersByAuctionOrder(players);

  if (orderedPlayers.length === 0) {
    return null;
  }

  if (!anchorPlayerId) {
    return findFirstUnsoldPlayer(orderedPlayers);
  }

  const anchorIndex = orderedPlayers.findIndex(
    (player) => player.id === anchorPlayerId,
  );

  if (anchorIndex === -1) {
    return findFirstUnsoldPlayer(orderedPlayers);
  }

  for (let offset = 0; offset < orderedPlayers.length; offset += 1) {
    const candidate =
      orderedPlayers[(anchorIndex + offset) % orderedPlayers.length];
    if (candidate.status === "UNSOLD") {
      return candidate;
    }
  }

  return null;
}

async function getSessionProgressionState(
  supabase: SupabaseAdminClient,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from("AuctionSession")
    .select(
      "id,unsoldIterationRound,unsoldIterationAnchorPlayerId,restartAckRequired,isAuctionEnded,auctionEndReason",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Auction session not found");

  return data as SessionProgressionState;
}

async function getOrderedSessionPlayers(
  supabase: SupabaseAdminClient,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from("Player")
    .select("id,name,position1,importOrder,status")
    .eq("sessionId", sessionId)
    .order("importOrder");

  if (error) throw error;

  return sortPlayersByAuctionOrder((data ?? []) as ProgressionPlayer[]);
}

async function resetLivePlayer(
  supabase: SupabaseAdminClient,
  sessionId: string,
) {
  const { error } = await supabase
    .from("Player")
    .update({ status: "UNSOLD" })
    .eq("sessionId", sessionId)
    .eq("status", "IN_AUCTION");

  if (error) throw error;
}

async function setLivePlayer(
  supabase: SupabaseAdminClient,
  sessionId: string,
  nextPlayerId: string,
) {
  const { data, error } = await supabase
    .from("Player")
    .update({ status: "IN_AUCTION" })
    .eq("sessionId", sessionId)
    .eq("id", nextPlayerId)
    .eq("status", "UNSOLD")
    .select("id")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("Failed to promote next player to IN_AUCTION");
  }
}

async function updateSessionProgression(
  supabase: SupabaseAdminClient,
  sessionId: string,
  update: {
    unsoldIterationRound: number;
    unsoldIterationAnchorPlayerId: string | null;
    restartAckRequired: boolean;
    isAuctionEnded: boolean;
    auctionEndReason: AuctionEndReason | null;
    endedAt: string | null;
  },
) {
  const { error } = await supabase
    .from("AuctionSession")
    .update(update)
    .eq("id", sessionId);

  if (error) throw error;
}

export async function advanceToNextPlayer(
  supabase: SupabaseAdminClient,
  sessionId: string,
  options?: {
    referencePlayerId?: string | null;
  },
) {
  const sessionState = await getSessionProgressionState(supabase, sessionId);
  const currentRound = normalizeRound(sessionState.unsoldIterationRound);

  if (sessionState.isAuctionEnded) {
    return {
      nextPlayer: null,
      didWrap: false,
      restartedFromAnchor: false,
      restartAckRequired: false,
      auctionEnded: true,
      endReason: sessionState.auctionEndReason,
      currentRound,
    } satisfies AuctionProgressionResult;
  }

  const orderedPlayers = await getOrderedSessionPlayers(supabase, sessionId);

  if (orderedPlayers.length === 0) {
    await updateSessionProgression(supabase, sessionId, {
      unsoldIterationRound: currentRound,
      unsoldIterationAnchorPlayerId: null,
      restartAckRequired: false,
      isAuctionEnded: true,
      auctionEndReason: "UNSOLD_DEPLETED",
      endedAt: new Date().toISOString(),
    });

    return {
      nextPlayer: null,
      didWrap: false,
      restartedFromAnchor: false,
      restartAckRequired: false,
      auctionEnded: true,
      endReason: "UNSOLD_DEPLETED",
      currentRound,
    } satisfies AuctionProgressionResult;
  }

  const workingPlayers = orderedPlayers.map((player) =>
    player.status === "IN_AUCTION"
      ? { ...player, status: "UNSOLD" as const }
      : player,
  );

  const firstUnsold = findFirstUnsoldPlayer(workingPlayers);
  const anchorPlayerId =
    sessionState.unsoldIterationAnchorPlayerId ?? firstUnsold?.id ?? null;

  if (!firstUnsold) {
    await resetLivePlayer(supabase, sessionId);
    await updateSessionProgression(supabase, sessionId, {
      unsoldIterationRound: currentRound,
      unsoldIterationAnchorPlayerId: anchorPlayerId,
      restartAckRequired: false,
      isAuctionEnded: true,
      auctionEndReason: "UNSOLD_DEPLETED",
      endedAt: new Date().toISOString(),
    });

    return {
      nextPlayer: null,
      didWrap: false,
      restartedFromAnchor: false,
      restartAckRequired: false,
      auctionEnded: true,
      endReason: "UNSOLD_DEPLETED",
      currentRound,
    } satisfies AuctionProgressionResult;
  }

  const referencePlayerId =
    options?.referencePlayerId ??
    orderedPlayers.find((player) => player.status === "IN_AUCTION")?.id ??
    null;
  const referenceIndex = referencePlayerId
    ? workingPlayers.findIndex((player) => player.id === referencePlayerId)
    : -1;

  const nextUnsoldResult = findNextUnsoldPlayer(workingPlayers, referenceIndex);

  let nextRound = currentRound;
  let nextPlayer = nextUnsoldResult.player;
  const didWrap = nextUnsoldResult.didWrap;
  let restartedFromAnchor = false;
  let restartAckRequired = false;
  let auctionEnded = false;
  let endReason: AuctionEndReason | null = null;

  if (didWrap) {
    if (currentRound >= 2) {
      nextPlayer = null;
      auctionEnded = true;
      endReason = "ITERATION_LIMIT_REACHED";
      restartAckRequired = false;
    } else {
      nextRound = 2;
      restartedFromAnchor = true;
      restartAckRequired = true;
      nextPlayer = findRestartTarget(workingPlayers, anchorPlayerId);

      if (!nextPlayer) {
        auctionEnded = true;
        endReason = "UNSOLD_DEPLETED";
        restartAckRequired = false;
      }
    }
  }

  if (!nextPlayer && !auctionEnded) {
    auctionEnded = true;
    endReason = "UNSOLD_DEPLETED";
    restartAckRequired = false;
  }

  await resetLivePlayer(supabase, sessionId);

  if (nextPlayer && !auctionEnded) {
    await setLivePlayer(supabase, sessionId, nextPlayer.id);
  }

  await updateSessionProgression(supabase, sessionId, {
    unsoldIterationRound: nextRound,
    unsoldIterationAnchorPlayerId: anchorPlayerId,
    restartAckRequired,
    isAuctionEnded: auctionEnded,
    auctionEndReason: endReason,
    endedAt: auctionEnded ? new Date().toISOString() : null,
  });

  return {
    nextPlayer: nextPlayer
      ? {
          ...nextPlayer,
          status: "IN_AUCTION",
        }
      : null,
    didWrap,
    restartedFromAnchor,
    restartAckRequired,
    auctionEnded,
    endReason,
    currentRound: nextRound,
  } satisfies AuctionProgressionResult;
}
