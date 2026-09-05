export type QueuePlayer = {
  id: string;
  status: "UNSOLD" | "IN_AUCTION" | "SOLD";
};

/** Returns unsold players in the circular queue after the live player. */
export function getUpcomingQueuePlayers<T extends QueuePlayer>(
  orderedPlayers: T[],
  currentPlayerId: string | null,
): T[] {
  if (orderedPlayers.length === 0) return [];

  if (!currentPlayerId) {
    return orderedPlayers.filter((player) => player.status === "UNSOLD");
  }

  const currentIndex = orderedPlayers.findIndex(
    (player) => player.id === currentPlayerId,
  );

  if (currentIndex === -1) {
    return orderedPlayers.filter((player) => player.status === "UNSOLD");
  }

  const upcoming: T[] = [];
  for (let offset = 1; offset < orderedPlayers.length; offset += 1) {
    const candidate =
      orderedPlayers[(currentIndex + offset) % orderedPlayers.length];
    if (candidate.status === "UNSOLD") upcoming.push(candidate);
  }

  return upcoming;
}
