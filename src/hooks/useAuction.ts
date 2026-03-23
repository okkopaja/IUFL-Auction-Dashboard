import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuctionStore } from "@/store/auctionStore";
import type { AuctionStats, Player, Team, Transaction } from "@/types";

export const QUERY_KEYS = {
  teams: ["teams"],
  team: (id: string) => ["team", id],
  players: (status?: string) => ["players", { status }],
  currentPlayer: ["currentPlayer"],
  auctionLog: ["auctionLog"],
  auctionStats: ["auctionStats"],
};

export function useTeams() {
  return useQuery({
    queryKey: QUERY_KEYS.teams,
    queryFn: async () => {
      const { data } = await api.get("/teams");
      return data.data as Team[];
    },
  });
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.team(id),
    queryFn: async () => {
      const { data } = await api.get(`/teams/${id}`);
      return data.data as Team;
    },
    enabled: !!id,
  });
}

export function usePlayers(status?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.players(status),
    queryFn: async () => {
      const params = status ? { status } : {};
      const { data } = await api.get("/players", { params });
      return data.data as Player[];
    },
  });
}

export function useCurrentPlayer() {
  return useQuery({
    queryKey: QUERY_KEYS.currentPlayer,
    queryFn: async () => {
      const { data } = await api.get("/players/current");
      return (data.data as Player) || null;
    },
  });
}

export function useAuctionLog() {
  return useQuery({
    queryKey: QUERY_KEYS.auctionLog,
    queryFn: async () => {
      const { data } = await api.get("/auction/log");
      return data.data as Transaction[];
    },
  });
}

export function useAuctionStats() {
  return useQuery({
    queryKey: QUERY_KEYS.auctionStats,
    queryFn: async () => {
      const { data } = await api.get("/auction/stats");
      return data.data as AuctionStats;
    },
  });
}

export function useSellPlayer() {
  const queryClient = useQueryClient();
  const setLastTransaction = useAuctionStore(
    (state) => state.setLastTransaction,
  );
  const resetForNewPlayer = useAuctionStore((state) => state.resetForNewPlayer);

  return useMutation({
    mutationFn: async ({
      teamId,
      amount,
    }: {
      teamId: string;
      amount: number;
    }) => {
      const { data } = await api.post("/auction/sell", { teamId, amount });
      return data.data;
    },
    onSuccess: (data, variables) => {
      setLastTransaction({
        playerId: data.transaction.playerId,
        teamId: variables.teamId,
        amount: variables.amount,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teams });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.currentPlayer });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auctionStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auctionLog });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.players() });
      if (data.nextPlayer) {
        resetForNewPlayer(data.nextPlayer.basePrice);
      }
    },
  });
}

export function useNextPlayer() {
  const queryClient = useQueryClient();
  const resetForNewPlayer = useAuctionStore((state) => state.resetForNewPlayer);

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/auction/next");
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.currentPlayer });
      if (data.nextPlayer) {
        resetForNewPlayer(data.nextPlayer.basePrice);
      }
    },
  });
}
