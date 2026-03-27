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

export const AUCTION_START_BID = 50;
export const AUCTION_BID_STEP_BASE = 50;
export const AUCTION_BID_STEP_HIGH = 100;
export const AUCTION_BID_STEP_THRESHOLD = 500;

export const ROUTES = {
  HOME: "/",
  DASHBOARD: "/dashboard",
  AUCTION: "/auction",
  TEAM: (teamSlug: string) => `/team/${teamSlug}`,
  PLAYERS_SOLD: "/players/sold",
  PLAYERS_UNSOLD: "/players/unsold",
};

export const SESSION_STRINGS = {
  ACTIVE_SESSION_NAME: "IUFL 2026 Player Auction",
};
