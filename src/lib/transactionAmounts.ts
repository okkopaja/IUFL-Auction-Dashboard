type TransactionAmountSource = {
  playerId: string;
  amount: number;
  createdAt?: string | null;
};

export function buildLatestTransactionAmountMap(
  transactions: TransactionAmountSource[],
) {
  const latestByPlayerId = new Map<
    string,
    { amount: number; createdAtMs: number }
  >();

  for (const transaction of transactions) {
    const createdAtMs = Number.isFinite(Date.parse(transaction.createdAt ?? ""))
      ? Date.parse(transaction.createdAt ?? "")
      : 0;

    const existing = latestByPlayerId.get(transaction.playerId);
    if (!existing || createdAtMs >= existing.createdAtMs) {
      latestByPlayerId.set(transaction.playerId, {
        amount: transaction.amount,
        createdAtMs,
      });
    }
  }

  return new Map(
    [...latestByPlayerId.entries()].map(([playerId, value]) => [
      playerId,
      value.amount,
    ]),
  );
}

export function withTransactionAmounts<T extends { id: string }>(
  players: T[],
  transactions: TransactionAmountSource[],
): Array<T & { transactionAmount: number | null }> {
  const amountByPlayerId = buildLatestTransactionAmountMap(transactions);

  return players.map((player) => ({
    ...player,
    transactionAmount: amountByPlayerId.get(player.id) ?? null,
  }));
}
