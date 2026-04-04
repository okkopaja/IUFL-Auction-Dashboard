export type PlayerStatus = "UNSOLD" | "IN_AUCTION" | "SOLD";
export type TeamRole = "OWNER" | "CO_OWNER" | "CAPTAIN" | "MARQUEE";
export type AuctionActionType = "PASS" | "SELL";
export type AuctionEndReason = "UNSOLD_DEPLETED" | "ITERATION_LIMIT_REACHED";

export interface AuctionProgressionMeta {
  nextPlayer: Player | null;
  didWrap: boolean;
  restartedFromAnchor: boolean;
  restartAckRequired: boolean;
  auctionEnded: boolean;
  endReason: AuctionEndReason | null;
  currentRound: number;
}

export interface CurrentPlayerState {
  player: Player | null;
  isComplete: boolean;
  restartAckRequired: boolean;
  unsoldIterationRound: number;
  isAuctionEnded: boolean;
  auctionEndReason: AuctionEndReason | null;
}

export interface TeamRoleProfile {
  id: string;
  teamId: string;
  role: TeamRole;
  name?: string | null;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamRoleSlot {
  name?: string | null;
  imageUrl?: string | null;
}

export interface Player {
  id: string;
  name: string;
  position1: string;
  position2?: string | null;
  basePrice: number;
  status: PlayerStatus;
  teamId?: string | null;
  transactionAmount?: number | null;
  imageUrl?: string | null;
  year?: string | null;
  whatsappNumber?: string | null;
  stream?: string;
  importOrder?: number;
  team?: Team | null;
}

export interface Team {
  id: string;
  name: string;
  shortCode: string;
  domain: string;
  pointsTotal: number;
  pointsSpent: number;
  pointsRemaining: number;
  playersOwnedCount: number;
  sessionId: string;
  owner?: TeamRoleSlot;
  coOwner?: TeamRoleSlot;
  captain?: TeamRoleSlot;
  marquee?: TeamRoleSlot;
  roleProfiles?: TeamRoleProfile[];
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

export interface AuctionActionHistoryEntry {
  id: string;
  actionType: AuctionActionType;
  createdAt: string;
  fromPlayer: Player;
  toPlayer: Player | null;
  transaction: Transaction | null;
}

export type PreviousActionMode = "SELL_PREVIEW" | "PASS_REVERTED";

export type PreviousActionResponse =
  | {
      mode: "SELL_PREVIEW";
      entry: AuctionActionHistoryEntry;
    }
  | {
      mode: "PASS_REVERTED";
      consumedActionId: string;
      currentPlayer: Player;
    };

export interface AuctionSession {
  id: string;
  name: string;
  isActive: boolean;
  unsoldIterationRound?: number;
  unsoldIterationAnchorPlayerId?: string | null;
  restartAckRequired?: boolean;
  isAuctionEnded?: boolean;
  auctionEndReason?: AuctionEndReason | null;
  endedAt?: string | null;
}

export interface AuctionStats {
  soldCount: number;
  unsoldCount: number;
  totalSpent: number;
  totalTeams: number;
  totalPlayers: number;
}
