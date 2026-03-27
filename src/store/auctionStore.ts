import { create } from "zustand";
import { AUCTION_START_BID } from "@/lib/constants";

interface AuctionState {
  currentBid: number;
  selectedTeamId: string | null;
  lastTransaction: { playerId: string; teamId: string; amount: number } | null;
  setBid: (bid: number) => void;
  setSelectedTeamId: (teamId: string | null) => void;
  setLastTransaction: (tx: {
    playerId: string;
    teamId: string;
    amount: number;
  }) => void;
  resetForNewPlayer: () => void;
}

export const useAuctionStore = create<AuctionState>((set) => ({
  currentBid: 0,
  selectedTeamId: null,
  lastTransaction: null,
  setBid: (bid) => set({ currentBid: bid }),
  setSelectedTeamId: (teamId) => set({ selectedTeamId: teamId }),
  setLastTransaction: (tx) => set({ lastTransaction: tx }),
  resetForNewPlayer: () =>
    set({ currentBid: AUCTION_START_BID, selectedTeamId: null }),
}));
