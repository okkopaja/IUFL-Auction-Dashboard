import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { buildNormalizedIconNameSet } from "./iconNames";

type SupabaseAdminClient = SupabaseClient<Database>;

export async function loadIconNameSetForSession(
  supabase: SupabaseAdminClient,
  sessionId: string,
): Promise<Set<string>> {
  const { data: teams, error: teamsError } = await supabase
    .from("Team")
    .select("id")
    .eq("sessionId", sessionId);

  if (teamsError) throw teamsError;

  const teamIds = (teams ?? []).map((team) => team.id);
  if (teamIds.length === 0) {
    return new Set<string>();
  }

  const { data: roleProfiles, error: roleProfilesError } = await supabase
    .from("TeamRoleProfile")
    .select("name")
    .in("teamId", teamIds);

  if (roleProfilesError) throw roleProfilesError;

  return buildNormalizedIconNameSet(roleProfiles ?? []);
}
