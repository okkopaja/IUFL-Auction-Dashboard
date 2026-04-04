import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const WATCHGOD_PAGE_SIZE = 15;

export type WatchgodQueueType = "PASSED" | "CURRENT" | "UPCOMING";

export interface WatchgodPlayerRow {
  id: string;
  name: string;
  position1: string;
  importOrder: number;
  status: "UNSOLD" | "IN_AUCTION" | "SOLD";
  teamId: string | null;
  teamShortCode: string | null;
  transactionAmount: number | null;
}

export interface WatchgodProgressionRow {
  id: string;
  queueType: WatchgodQueueType;
  actionType: "PASS" | "SELL" | null;
  actionAt: string | null;
  player: WatchgodPlayerRow;
}

export interface WatchgodTeamRow {
  id: string;
  name: string;
  shortCode: string;
  pointsTotal: number;
  pointsSpent: number;
  pointsRemaining: number;
  playersOwnedCount: number;
  maxBid: number;
  canAffordMinimumBid: boolean;
}

export interface WatchgodSnapshotMeta {
  hasActiveSession: boolean;
  sessionId: string | null;
  currentPlayerId: string | null;
  unsoldIterationRound: number;
  restartAckRequired: boolean;
  isAuctionEnded: boolean;
  auctionEndReason: "UNSOLD_DEPLETED" | "ITERATION_LIMIT_REACHED" | null;
  passedCount: number;
  upcomingCount: number;
  totalProgressionCount: number;
  pageSize: number;
  generatedAt: string;
}

export interface WatchgodSnapshot {
  progression: WatchgodProgressionRow[];
  teams: WatchgodTeamRow[];
  meta: WatchgodSnapshotMeta;
}

export interface WatcherTeamLivePlayer {
  id: string;
  name: string;
  position1: string;
  importOrder: number;
  amount: number;
}

export interface WatcherTeamSnapshot {
  id: string;
  name: string;
  shortCode: string;
  pointsTotal: number;
  pointsSpent: number;
  pointsRemaining: number;
  playersOwnedCount: number;
  maxBid: number;
  canAffordMinimumBid: boolean;
}

export interface WatcherTeamPlaygroundMeta {
  hasActiveSession: boolean;
  hasWatcherTeam: boolean;
  sessionId?: string;
  unsoldIterationRound?: number;
  restartAckRequired?: boolean;
  isAuctionEnded?: boolean;
  auctionEndReason?: "UNSOLD_DEPLETED" | "ITERATION_LIMIT_REACHED" | null;
  generatedAt: string;
}

export interface WatcherTeamPlaygroundSnapshot {
  team: WatcherTeamSnapshot | null;
  players: WatcherTeamLivePlayer[];
  meta: WatcherTeamPlaygroundMeta;
}

export function useWatchgodSnapshot() {
  return useQuery({
    queryKey: ["watchgodSnapshot"],
    queryFn: async () => {
      const { data } = await api.get("/watchgod");
      return data.data as WatchgodSnapshot;
    },
    refetchInterval: 2000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useWatcherTeamPlaygroundSnapshot() {
  return useQuery({
    queryKey: ["watchgodWatcherTeamPlayground"],
    queryFn: async () => {
      const { data } = await api.get("/watchgod/playground");
      return data.data as WatcherTeamPlaygroundSnapshot;
    },
    refetchInterval: 2000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
