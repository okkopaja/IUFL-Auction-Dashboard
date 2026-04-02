import type { Database } from "@/types/supabase";

export type TeamRole = Database["public"]["Enums"]["TeamRole"];

export type TeamRoleProfileRecord = Pick<
  Database["public"]["Tables"]["TeamRoleProfile"]["Row"],
  "role" | "name" | "imageUrl"
>;

export interface TeamRoleSlot {
  name: string | null;
  imageUrl: string | null;
}

export interface TeamRoleSummary {
  owner: TeamRoleSlot;
  coOwner: TeamRoleSlot;
  captain: TeamRoleSlot;
  marquee: TeamRoleSlot;
}

export const TEAM_ROLE_FIELD_TO_DB_ROLE = {
  owner: "OWNER",
  coOwner: "CO_OWNER",
  captain: "CAPTAIN",
  marquee: "MARQUEE",
} as const;

const TEAM_ROLE_TO_FIELD: Record<TeamRole, keyof TeamRoleSummary> = {
  OWNER: "owner",
  CO_OWNER: "coOwner",
  CAPTAIN: "captain",
  MARQUEE: "marquee",
};

export function getEmptyTeamRoleSummary(): TeamRoleSummary {
  return {
    owner: { name: null, imageUrl: null },
    coOwner: { name: null, imageUrl: null },
    captain: { name: null, imageUrl: null },
    marquee: { name: null, imageUrl: null },
  };
}

export function mapTeamRoleProfiles(
  roleProfiles: TeamRoleProfileRecord[] | null | undefined,
): TeamRoleSummary {
  const mapped = getEmptyTeamRoleSummary();

  for (const roleProfile of roleProfiles ?? []) {
    const field = TEAM_ROLE_TO_FIELD[roleProfile.role];
    mapped[field] = {
      name: roleProfile.name ?? null,
      imageUrl: roleProfile.imageUrl ?? null,
    };
  }

  return mapped;
}
