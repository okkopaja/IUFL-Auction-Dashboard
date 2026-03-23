export const TEAM_COLORS: Record<string, string> = {
  RMA: "#FFFFFF",
  MCI: "#6CABDD",
  BAY: "#DC052D",
  PSG: "#004170",
  LIV: "#C8102E",
  ARS: "#EF0107",
  INC: "#001850",
  BAR: "#004D98",
  DOR: "#FDE100",
  ATM: "#CB3524",
  JUV: "#000000",
  MIL: "#FB090B",
  NAP: "#12A0D7",
  RBL: "#DD013F",
  POR: "#00257B",
  BEN: "#E81B24",
};

export const AUCTION_BID_STEP = 10;

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
