export interface AuctionTeamSeed {
  name: string;
  shortCode: string;
  domain: string;
}

export const AUCTION_TEAM_SEEDS: AuctionTeamSeed[] = [
  { name: "Arsenal FC", shortCode: "ARS", domain: "arsenal.com" },
  { name: "FC Inter Milan", shortCode: "INT", domain: "inter.it" },
  { name: "S.L. Benfica", shortCode: "BEN", domain: "slbenfica.pt" },
  { name: "Chelsea FC", shortCode: "CHE", domain: "chelseafc.com" },
  { name: "Manchester City", shortCode: "MCI", domain: "mancity.com" },
  { name: "FC Barcelona", shortCode: "BAR", domain: "fcbarcelona.com" },
  { name: "Paris Saint-Germain", shortCode: "PSG", domain: "psg.fr" },
  { name: "Newcastle United", shortCode: "NEW", domain: "nufc.co.uk" },
  {
    name: "Atletico de Madrid",
    shortCode: "ATL",
    domain: "atleticodemadrid.com",
  },
  { name: "Juventus FC", shortCode: "JUV", domain: "juventus.com" },
  { name: "Liverpool FC", shortCode: "LIV", domain: "liverpoolfc.com" },
  { name: "Real Madrid", shortCode: "RMA", domain: "realmadrid.com" },
  { name: "Borussia Dortmund", shortCode: "BVB", domain: "bvb.de" },
  { name: "Sporting CP", shortCode: "SCP", domain: "sporting.pt" },
  { name: "AC Milan", shortCode: "ACM", domain: "acmilan.com" },
  { name: "FC Bayern Munich", shortCode: "BAY", domain: "fcbayern.com" },
];

export const AUCTION_TEAM_COUNT = AUCTION_TEAM_SEEDS.length;
