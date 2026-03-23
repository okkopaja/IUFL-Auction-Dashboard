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
      <SheetTrigger>
        <Button
          variant="outline"
          className="w-full h-16 justify-between bg-pitch-950 border-slate-700 hover:bg-slate-800 hover:text-white"
        >
          {selectedTeam ? (
            <div className="flex items-center gap-3">
              <TeamLogo
                domain={selectedTeam.domain}
                name={selectedTeam.name}
                size={24}
              />
              <span className="font-bold">{selectedTeam.shortCode}</span>
            </div>
          ) : (
            <span className="text-slate-400">Select Franchise...</span>
          )}
          <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-slate-300">
            {selectedTeam ? selectedTeam.pointsRemaining : "---"} pts
          </span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="bg-pitch-900 border-t border-slate-800 h-[70vh] rounded-t-3xl sm:hidden flex flex-col p-4"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-xl text-slate-100 uppercase tracking-widest font-heading text-left">
            Select Franchise
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto w-full flex flex-col gap-2 scrollbar-hide pb-10">
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
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? "bg-slate-800/80"
                    : "bg-pitch-800/20 active:bg-pitch-800 border-transparent"
                }`}
                style={{
                  borderColor: isSelected ? color : "transparent",
                }}
              >
                <div className="flex items-center gap-3">
                  <TeamLogo domain={team.domain} name={team.name} size={36} />
                  <div className="flex flex-col">
                    <span
                      className={`font-bold text-sm ${isSelected ? "text-white" : "text-slate-300"}`}
                    >
                      {team.shortCode}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                      {team.playersOwnedCount} P
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    className={`font-mono font-bold ${isSelected ? "text-accent-gold" : "text-slate-400"}`}
                  >
                    {team.pointsRemaining}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono uppercase">
                    PTS
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
