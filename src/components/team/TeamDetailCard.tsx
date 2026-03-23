"use client";

import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { useTeam } from "@/hooks/useAuction";
import { ROUTES, TEAM_COLORS } from "@/lib/constants";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { TeamLogo } from "../shared/TeamLogo";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export function TeamDetailCard({ teamId }: { teamId: string }) {
  const { data: team, isLoading, error, refetch } = useTeam(teamId);

  if (isLoading) return <LoadingState />;
  if (error)
    return <ErrorState error={error as Error} reset={() => refetch()} />;
  if (!team)
    return (
      <div className="text-center p-12 text-slate-500">Team not found</div>
    );

  const color = TEAM_COLORS[team.shortCode] || "#ffffff";

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 z-10 relative">
      <div>
        <Link href={ROUTES.DASHBOARD}>
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-white mb-2 uppercase tracking-widest text-xs font-bold px-0 hover:bg-transparent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </Link>
      </div>

      <div
        className="bg-pitch-900 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row gap-8 items-center md:items-start"
        style={{ borderTopColor: color, borderTopWidth: 4 }}
      >
        <div
          className="absolute top-0 right-0 w-[400px] h-[400px] opacity-[0.08] pointer-events-none rounded-full blur-[80px]"
          style={{ backgroundColor: color }}
        />

        <TeamLogo
          domain={team.domain}
          name={team.name}
          size={140}
          className="drop-shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 shrink-0"
        />

        <div className="flex-1 flex flex-col items-center md:items-start z-10 text-center md:text-left w-full mt-4 md:mt-0">
          <h1 className="text-4xl md:text-6xl font-heading font-black text-white tracking-tight mb-2 uppercase">
            {team.name}
          </h1>
          <h2 className="text-xl md:text-3xl text-slate-400 font-bold tracking-widest uppercase mb-8">
            {team.shortCode}
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <StatBox label="Total Budget" value={team.pointsTotal} />
            <StatBox
              label="Spent"
              value={team.pointsSpent}
              color="text-destructive"
            />
            <StatBox
              label="Remaining"
              value={team.pointsRemaining}
              color="text-accent-gold"
            />
            <StatBox label="Players" value={team.playersOwnedCount} />
          </div>
        </div>
      </div>

      <div className="bg-pitch-900 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur z-10 shadow-2xl">
        <div className="p-6 md:px-8 border-b border-slate-800 flex items-center justify-between bg-black/20">
          <h3 className="text-xl font-heading font-bold uppercase tracking-widest text-slate-200 flex items-center gap-3">
            <Users className="w-6 h-6 text-slate-500" />
            Roster
          </h3>
          <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs font-mono font-bold uppercase tracking-widest">
            {team.playersOwnedCount} / 30
          </span>
        </div>

        {team.players && team.players.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-500 uppercase tracking-widest text-xs font-bold pl-6 md:pl-8 py-5">
                    Player Name
                  </TableHead>
                  <TableHead className="text-slate-500 uppercase tracking-widest text-xs font-bold w-[150px]">
                    Position
                  </TableHead>
                  <TableHead className="text-slate-500 uppercase tracking-widest text-xs font-bold text-right pr-6 md:pr-8 w-[200px]">
                    Paid
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.players.map((player) => (
                  <TableRow
                    key={player.id}
                    className="border-slate-800 hover:bg-slate-800/30 transition-colors"
                  >
                    <TableCell className="font-bold text-slate-200 pl-6 md:pl-8 text-base py-4">
                      {player.name}
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-[10px] font-bold border border-slate-700 uppercase tracking-wider">
                        {player.position}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6 md:pr-8 font-mono text-xl font-bold text-accent-gold drop-shadow-sm">
                      {player.transactionAmount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-20 text-slate-500 gap-4">
            <div className="w-20 h-20 rounded-full bg-slate-800/30 flex items-center justify-center mb-2">
              <Users className="w-10 h-10 text-slate-600" />
            </div>
            <p className="font-mono text-sm uppercase tracking-widest">
              No players signed yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex flex-col bg-pitch-950/50 p-5 rounded-2xl border border-slate-800/80 hover:bg-slate-800/30 transition-colors shadow-inner w-full">
      <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mb-2">
        {label}
      </span>
      <span
        className={`text-2xl md:text-4xl font-mono font-black ${color} drop-shadow-sm`}
      >
        {value}
      </span>
    </div>
  );
}
