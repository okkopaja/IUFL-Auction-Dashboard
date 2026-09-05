import { getSupabaseAdminClient } from "@/lib/supabase";
import { tdPrisma } from "@/lib/teams-dist/prisma";

type SessionRow = { id: string };
type TeamNameRow = { name: string };

function normalizeTeamName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

async function findMatchingAuctionSession(tournamentId: string) {
  const tournamentTeams = await tdPrisma.tdTeam.findMany({
    where: { tournamentId },
    select: { name: true },
  });

  if (tournamentTeams.length === 0) return null;

  const expectedNames = new Set(
    (tournamentTeams as Array<{ name: string }>).map((team) =>
      normalizeTeamName(team.name),
    ),
  );
  const supabase = getSupabaseAdminClient();
  const { data: sessions, error: sessionsError } = await supabase
    .from("AuctionSession")
    .select("id");

  if (sessionsError) throw sessionsError;

  for (const session of (sessions ?? []) as SessionRow[]) {
    const { data: teams, error: teamsError } = await supabase
      .from("Team")
      .select("name")
      .eq("sessionId", session.id);

    if (teamsError) throw teamsError;
    if (teams?.length !== expectedNames.size) continue;

    const actualNames = new Set(
      (teams ?? ([] as TeamNameRow[])).map((team) =>
        normalizeTeamName(team.name),
      ),
    );
    if (
      actualNames.size === expectedNames.size &&
      [...expectedNames].every((name) => actualNames.has(name))
    ) {
      return session.id;
    }
  }

  return null;
}

export async function ensureTournamentSession(tournamentId: string) {
  const tournament = await tdPrisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) return null;
  if (tournament.auctionSessionId) {
    const supabase = getSupabaseAdminClient();
    const { data: linkedSession, error: linkedSessionError } = await supabase
      .from("AuctionSession")
      .select("id,isActive")
      .eq("id", tournament.auctionSessionId)
      .maybeSingle();

    if (linkedSessionError) throw linkedSessionError;
    const matchingSessionId = await findMatchingAuctionSession(tournamentId);
    if (
      matchingSessionId &&
      matchingSessionId !== tournament.auctionSessionId
    ) {
      const repairedTournament = await tdPrisma.tournament.update({
        where: { id: tournament.id },
        data: { auctionSessionId: matchingSessionId },
      });

      if (linkedSession?.isActive) {
        const { error: deactivateError } = await supabase
          .from("AuctionSession")
          .update({ isActive: false })
          .eq("isActive", true);

        if (deactivateError) throw deactivateError;

        const { error: activateError } = await supabase
          .from("AuctionSession")
          .update({ isActive: true })
          .eq("id", matchingSessionId);

        if (activateError) throw activateError;
      }

      return { tournament: repairedTournament, sessionId: matchingSessionId };
    }

    return { tournament, sessionId: tournament.auctionSessionId };
  }

  const matchingSessionId = await findMatchingAuctionSession(tournamentId);
  if (matchingSessionId) {
    const linkedTournament = await tdPrisma.tournament.update({
      where: { id: tournament.id },
      data: { auctionSessionId: matchingSessionId },
    });

    return { tournament: linkedTournament, sessionId: matchingSessionId };
  }

  const supabase = getSupabaseAdminClient();
  const { data: session, error } = await supabase
    .from("AuctionSession")
    .insert({
      id: crypto.randomUUID(),
      name: tournament.name,
      isActive: false,
      totalPoints: 1000,
      updatedAt: new Date().toISOString(),
    })
    .select("id")
    .single<SessionRow>();

  if (error) throw error;

  const linkedTournament = await tdPrisma.tournament.update({
    where: { id: tournament.id },
    data: { auctionSessionId: session.id },
  });

  return { tournament: linkedTournament, sessionId: session.id };
}

export async function activateTournament(tournamentId: string) {
  const resolved = await ensureTournamentSession(tournamentId);
  if (!resolved) return null;

  const supabase = getSupabaseAdminClient();
  const { error: deactivateError } = await supabase
    .from("AuctionSession")
    .update({ isActive: false })
    .eq("isActive", true);

  if (deactivateError) throw deactivateError;

  const { data: session, error: activateError } = await supabase
    .from("AuctionSession")
    .update({ isActive: true })
    .eq("id", resolved.sessionId)
    .select("id")
    .maybeSingle<SessionRow>();

  if (activateError) throw activateError;
  if (!session) throw new Error("Linked auction session not found");

  return resolved;
}
