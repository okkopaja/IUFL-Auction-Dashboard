export type PlayerStatus = "UNSOLD" | "IN_AUCTION" | "SOLD";

export interface Player {
  id: string;
  name: string;
  position: string;
  basePrice: number;
  status: PlayerStatus;
  teamId?: string | null;
  transactionAmount?: number | null;
  imageUrl?: string | null;
  year?: string | null;
  team?: Team | null;
}

export interface Team {
  id: string;
  slug: string;
  name: string;
  shortCode: string;
  domain: string;
  pointsTotal: number;
  pointsSpent: number;
  pointsRemaining: number;
  playersOwnedCount: number;
  sessionId: string;
  players: Player[];
  transactions: Transaction[];
}

export interface Transaction {
  id: string;
  playerId: string;
  teamId: string;
  amount: number;
  createdAt: string;
  player: Player;
  team: Team;
}

export interface AuctionSession {
  id: string;
  name: string;
  isActive: boolean;
}

export interface AuctionStats {
  soldCount: number;
  unsoldCount: number;
  totalSpent: number;
  totalTeams: number;
}
