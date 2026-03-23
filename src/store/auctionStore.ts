import { create } from "zustand";

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
  resetForNewPlayer: (basePrice: number) => void;
}

export const useAuctionStore = create<AuctionState>((set) => ({
  currentBid: 0,
  selectedTeamId: null,
  lastTransaction: null,
  setBid: (bid) => set({ currentBid: bid }),
  setSelectedTeamId: (teamId) => set({ selectedTeamId: teamId }),
  setLastTransaction: (tx) => set({ lastTransaction: tx }),
  resetForNewPlayer: (basePrice) =>
    set({ currentBid: basePrice, selectedTeamId: null }),
}));
