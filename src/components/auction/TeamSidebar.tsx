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
    <div className="w-full flex flex-col scrollbar-hide">
      {sortedTeams.map((team) => {
        const isSelected = selectedTeamId === team.id;
        const color = TEAM_COLORS[team.shortCode] || "#ffffff";

        return (
          <div
            key={team.id}
            onClick={() => setSelectedTeamId(team.id)}
            className={`group relative flex items-center justify-between p-3 cursor-pointer transition-colors border-b border-[#222] last:border-b-0 ${
              isSelected ? "bg-[#1a1a1a]" : "hover:bg-[#161616]"
            }`}
          >
            {/* Selection left border indicator */}
            {isSelected && (
              <div
                className="absolute left-0 top-0 bottom-0 w-1 transition-all"
                style={{ backgroundColor: color }}
              />
            )}

            <div className="flex items-center gap-3 pl-2">
              <TeamLogo domain={team.domain} name={team.name} size={32} />
              <div className="flex flex-col">
                <span
                  className={`font-semibold text-sm tracking-wide ${
                    isSelected
                      ? "text-white"
                      : "text-slate-300 group-hover:text-white"
                  }`}
                >
                  {team.shortCode}
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                  PLAYERS:{" "}
                  <span className="text-slate-400">
                    {team.playersOwnedCount}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end pr-1">
              <span className="text-xs text-slate-500 font-mono tracking-widest uppercase">
                Pts
              </span>
              <span
                className={`font-mono font-medium text-sm tracking-tight ${
                  isSelected ? "text-white" : "text-slate-300"
                }`}
                style={{ color: isSelected ? color : undefined }}
              >
                {team.pointsRemaining.toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
