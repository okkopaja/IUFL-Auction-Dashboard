"use client";

import { useState } from "react";
import { TEAM_COLORS } from "@/lib/constants";
import { useAuctionStore } from "@/store/auctionStore";
import type { Team } from "@/types";
import { TeamLogo } from "../shared/TeamLogo";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";

export function TeamSelectPopup({ teams }: { teams: Team[] }) {
  const selectedTeamId = useAuctionStore((state) => state.selectedTeamId);
  const setSelectedTeamId = useAuctionStore((state) => state.setSelectedTeamId);
  const [open, setOpen] = useState(false);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            className="w-full h-14 justify-between bg-[#111] border-[#333] hover:bg-[#1a1a1a] hover:text-white rounded-xl"
          />
        }
      >
        {selectedTeam ? (
          <div className="flex items-center gap-3">
            <TeamLogo
              domain={selectedTeam.domain}
              name={selectedTeam.name}
              size={20}
            />
            <span className="font-semibold text-sm">
              {selectedTeam.shortCode}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 text-sm">Select Franchise...</span>
        )}
        <span className="text-xs font-mono bg-[#222] px-2 py-1 rounded text-slate-300">
          {selectedTeam ? selectedTeam.pointsRemaining : "---"} pts
        </span>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="bg-[#0a0a0a] border-t border-[#222] h-[75vh] rounded-t-2xl sm:hidden flex flex-col p-0"
      >
        <SheetHeader className="p-4 border-b border-[#222]">
          <SheetTitle className="text-sm text-slate-400 uppercase tracking-widest font-semibold text-left">
            Select Franchise
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto w-full flex flex-col scrollbar-hide pb-10">
          {teams.map((team) => {
            const isSelected = selectedTeamId === team.id;
            const color = TEAM_COLORS[team.shortCode] || "#ffffff";

            return (
              <div
                key={team.id}
                onClick={() => {
                  setSelectedTeamId(team.id);
                  setOpen(false);
                }}
                className={`group relative flex items-center justify-between p-4 cursor-pointer transition-colors border-b border-[#222] last:border-b-0 ${
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
      </SheetContent>
    </Sheet>
  );
}
