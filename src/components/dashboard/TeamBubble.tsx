"use client";

import Link from "next/link";
import { ROUTES, TEAM_COLORS } from "@/lib/constants";
import type { Team } from "@/types";
import { TeamLogo } from "../shared/TeamLogo";

export function TeamBubble({ team }: { team: Team }) {
  const accentColor = TEAM_COLORS[team.shortCode] || "#ffffff";
  return (
    <Link href={ROUTES.TEAM(team.slug)}>
      <div
        className="group relative flex flex-col items-center justify-center p-6 rounded-2xl bg-pitch-900 border border-slate-800 transition-all duration-300 hover:scale-[1.05] hover:border-transparent hover:-translate-y-1 overflow-hidden"
        style={{
          boxShadow: `0 4px 20px -5px rgba(0,0,0,0.5)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 10px 40px -10px ${accentColor}40`;
          e.currentTarget.style.borderColor = accentColor;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = `0 4px 20px -5px rgba(0,0,0,0.5)`;
          e.currentTarget.style.borderColor = "rgba(30,34,51,0.5)";
        }}
      >
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-t from-transparent"
          style={{
            backgroundImage: `linear-gradient(to top, transparent, ${accentColor})`,
          }}
        />
        <TeamLogo
          domain={team.domain}
          name={team.name}
          size={64}
          className="mb-4 drop-shadow-lg group-hover:scale-110 transition-transform duration-300 z-10"
        />
        <h3 className="font-heading font-bold text-lg text-slate-100 z-10">
          {team.shortCode}
        </h3>
        <p className="text-xs text-slate-400 font-mono z-10">
          {team.playersOwnedCount} players
        </p>
      </div>
    </Link>
  );
}
