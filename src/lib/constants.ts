export const TEAM_COLORS: Record<string, string> = {
  ARS: "#EF0107",
  INT: "#001850",
  BEN: "#E81B24",
  CHE: "#034694",
  MCI: "#6CABDD",
  BAR: "#004D98",
  PSG: "#004170",
  NEW: "#241F20",
  ATL: "#CB3524",
  JUV: "#000000",
  LIV: "#C8102E",
  RMA: "#FFFFFF",
  BVB: "#FDE100",
  SCP: "#008057",
  ACM: "#FB090B",
  BAY: "#DC052D",
};

export const PLAYER_BASE_PRICE = 10;
export const AUCTION_START_BID = PLAYER_BASE_PRICE;
export const AUCTION_BID_INCREMENT_OPTIONS = [10, 20, 50, 100] as const;
export const AUCTION_TOTAL_SQUAD_SIZE = 16;
export const AUCTION_FIXED_ROLE_SLOTS = 2;
export const AUCTION_MANDATORY_PLAYER_SLOTS =
  AUCTION_TOTAL_SQUAD_SIZE - AUCTION_FIXED_ROLE_SLOTS;

export const ROUTES = {
  HOME: "/",
  PUBLIC: "/v1/public",
  PRIVATE: "/v1/private",
  SIGN_IN: "/v1/public/sign-in",
  SIGN_UP: "/v1/public/sign-up",
  PUBLIC_AUCTION: "/v1/public/auction",
  DASHBOARD: "/v1/private/dashboard",
  AUCTION: "/v1/private/auction/dashboard",
  ADMIN_DASHBOARD: "/v1/private/admin/dashboard",
  ADMIN_TEAMS: "/v1/private/admin/teams",
  ADMIN_PLAYERS: "/v1/private/admin/players",
  PLAYERS: "/v1/public/players",
  PLAYERS_GK: "/v1/public/players/gk",
  PLAYERS_DEFENCE: "/v1/public/players/defence",
  PLAYERS_MIDFIELDER: "/v1/public/players/midfielder",
  PLAYERS_ATTACKER: "/v1/public/players/attacker",
  TEAMS: "/v1/public/teams",
  TEAM: (teamId: string) => `/v1/public/team/${teamId}`,
  PLAYERS_SOLD: "/v1/public/players/sold",
  PLAYERS_UNSOLD: "/v1/public/players/unsold",
};

export const SESSION_STRINGS = {
  ACTIVE_SESSION_NAME: "IUFL 2026 Player Auction",
};
