import type { Team } from "@/types";
import { TeamBubble } from "./TeamBubble";

export function TeamGrid({ teams }: { teams: Team[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {teams.map((team) => (
        <TeamBubble key={team.id} team={team} />
      ))}
    </div>
  );
}
