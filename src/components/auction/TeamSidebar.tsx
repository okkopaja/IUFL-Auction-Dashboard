import { TEAM_COLORS } from "@/lib/constants";
import { useAuctionStore } from "@/store/auctionStore";
import type { Team } from "@/types";
import { TeamLogo } from "../shared/TeamLogo";

export function TeamSidebar({ teams }: { teams: Team[] }) {
  const selectedTeamId = useAuctionStore((state) => state.selectedTeamId);
  const setSelectedTeamId = useAuctionStore((state) => state.setSelectedTeamId);

  const sortedTeams = [...teams].sort(
    (a, b) => b.pointsRemaining - a.pointsRemaining,
  );

  return (
    <div className="flex-1 overflow-y-auto w-full flex flex-col gap-3 scrollbar-hide">
      {sortedTeams.map((team) => {
        const isSelected = selectedTeamId === team.id;
        const color = TEAM_COLORS[team.shortCode] || "#ffffff";

        return (
          <div
            key={team.id}
            onClick={() => setSelectedTeamId(team.id)}
            className={`flex items-center justify-between p-4 rounded-[1.5rem] cursor-pointer transition-all border ${
              isSelected
                ? "bg-slate-800/80"
                : "bg-pitch-800/30 hover:bg-pitch-800/60 border-slate-800/30 hover:border-slate-700/50"
            }`}
            style={{
              borderColor: isSelected ? color : undefined,
              boxShadow: isSelected ? `0 0 20px -5px ${color}60` : "none",
            }}
          >
            <div className="flex items-center gap-4">
              <TeamLogo domain={team.domain} name={team.name} size={40} />
              <div className="flex flex-col">
                <span
                  className={`font-bold text-sm tracking-wide ${isSelected ? "text-white" : "text-slate-200"}`}
                >
                  {team.shortCode}
                </span>
                <span className="text-xs text-slate-500 font-mono mt-0.5">
                  Pts:{" "}
                  <span
                    className={`${isSelected ? "text-accent-gold" : "text-slate-300"} font-bold`}
                  >
                    {team.pointsRemaining}
                  </span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Players:{" "}
                  <span className="text-slate-300 font-bold">
                    {team.playersOwnedCount}
                  </span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
