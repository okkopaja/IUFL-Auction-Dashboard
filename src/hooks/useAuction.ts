import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuctionStore } from "@/store/auctionStore";
import type {
  AuctionActionHistoryEntry,
  AuctionStats,
  Player,
  PreviousActionResponse,
  Team,
  Transaction,
} from "@/types";

export const QUERY_KEYS = {
  teams: ["teams"],
  team: (id: string) => ["team", id],
  players: (status?: string) => ["players", { status }],
  currentPlayer: ["currentPlayer"],
  auctionLog: ["auctionLog"],
  previousPlayer: ["previousPlayer"],
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
      return {
        player: (data.data as Player) || null,
        isComplete: Boolean(data.meta?.isComplete),
      };
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

export function usePreviousPlayerPreview() {
  return useQuery({
    queryKey: QUERY_KEYS.previousPlayer,
    queryFn: async () => {
      const { data } = await api.get("/auction/previous");
      return (data.data as AuctionActionHistoryEntry | null) ?? null;
    },
  });
}

export function useGoPrevious() {
  const queryClient = useQueryClient();
  const resetForNewPlayer = useAuctionStore((state) => state.resetForNewPlayer);

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/auction/previous");
      return data.data as PreviousActionResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.previousPlayer });

      if (data.mode === "PASS_REVERTED") {
        resetForNewPlayer();
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.currentPlayer });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auctionStats });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auctionLog });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.players() });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.players("SOLD") });
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.players("UNSOLD"),
        });
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.players("IN_AUCTION"),
        });
      }
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
      playerId,
      teamId,
      amount,
    }: {
      playerId: string;
      teamId: string;
      amount: number;
    }) => {
      const { data } = await api.post("/auction/sell", {
        playerId,
        teamId,
        amount,
      });
      return data.data;
    },
    onSuccess: (data, variables) => {
      setLastTransaction({
        playerId: data.transaction.playerId,
        teamId: variables.teamId,
        amount: variables.amount,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teams });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.team(variables.teamId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.currentPlayer });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auctionStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auctionLog });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.previousPlayer });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.players() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.players("SOLD") });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.players("UNSOLD") });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.players("IN_AUCTION"),
      });
      if (data.nextPlayer) {
        resetForNewPlayer();
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.previousPlayer });
      if (data.nextPlayer) {
        resetForNewPlayer();
      }
    },
  });
}

export function useUndoTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/auction/undo");
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teams });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.currentPlayer });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auctionStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auctionLog });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.previousPlayer });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.players() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.players("SOLD") });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.players("UNSOLD") });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.players("IN_AUCTION"),
      });
    },
  });
}
