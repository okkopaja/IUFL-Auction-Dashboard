import { AUCTION_TEAM_SEEDS } from "@/lib/auctionTeams";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { ensureTournamentSession } from "@/lib/teams-dist/tournamentSession";

type TdTeamInput = {
  name: string;
  shortName: string | null;
  country: string | null;
};

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function createShortCode(name: string, usedCodes: Set<string>): string {
  const compact = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const base = (compact.slice(0, 3) || "TEAM").padEnd(3, "X");
  let code = base;
  let suffix = 2;

  while (usedCodes.has(code)) {
    code = `${base.slice(0, Math.max(1, 3 - String(suffix).length))}${suffix}`;
    suffix += 1;
  }

  return code;
}

function getShortCode(team: TdTeamInput, usedCodes: Set<string>): string {
  const seeded = AUCTION_TEAM_SEEDS.find(
    (seed) => normalizeName(seed.name) === normalizeName(team.name),
  )?.shortCode;
  const requested = team.shortName?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const preferred = seeded ?? requested;

  if (preferred && !usedCodes.has(preferred)) return preferred;
  return createShortCode(team.name, usedCodes);
}

export async function syncTournamentTeamsToAuction(
  tournamentId: string,
  teams: TdTeamInput[],
) {
  const resolved = await ensureTournamentSession(tournamentId);
  if (!resolved) throw new Error("Tournament not found");

  const supabase = getSupabaseAdminClient();
  const { data: existingTeams, error: existingError } = await supabase
    .from("Team")
    .select("id,name,shortCode")
    .eq("sessionId", resolved.sessionId);

  if (existingError) throw existingError;

  const existingByName = new Map(
    (existingTeams ?? []).map((team) => [normalizeName(team.name), team]),
  );
  const usedCodes = new Set(
    (existingTeams ?? []).map((team) => team.shortCode.toUpperCase()),
  );

  for (const team of teams) {
    const existing = existingByName.get(normalizeName(team.name));
    if (existing) continue;

    const shortCode = getShortCode(team, usedCodes);
    usedCodes.add(shortCode);

    const seed = AUCTION_TEAM_SEEDS.find(
      (candidate) => normalizeName(candidate.name) === normalizeName(team.name),
    );

    const { error } = await supabase.from("Team").insert({
      id: crypto.randomUUID(),
      name: team.name,
      shortCode,
      domain: seed?.domain ?? "",
      pointsTotal: 1000,
      pointsSpent: 0,
      sessionId: resolved.sessionId,
      createdAt: new Date().toISOString(),
    });

    if (error) throw error;
  }

  return resolved.sessionId;
}