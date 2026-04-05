"use client";

import { ArrowLeft, Users, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PlayerDetailsDialog } from "@/components/dashboard/PlayerListView";
import type { Player } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { useTeam } from "@/hooks/useAuction";
import { ROUTES, TEAM_COLORS } from "@/lib/constants";
import { toDisplayImageUrl } from "@/lib/imageUrl";
import type { TeamRoleSlot } from "@/types";
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

function formatSoldAmount(amount: number | null | undefined): string {
  return typeof amount === "number" ? `${amount} pts` : "-";
}

export function TeamDetailCard({ teamId }: { teamId: string }) {
  const { data: team, isLoading, error, refetch } = useTeam(teamId);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  if (isLoading) return <LoadingState />;
  if (error)
    return <ErrorState error={error as Error} reset={() => refetch()} />;
  if (!team)
    return (
      <div className="text-center p-12 text-slate-500">Team not found</div>
    );

  const color = TEAM_COLORS[team.shortCode] || "#ffffff";
  const leadershipCards: Array<{
    label: string;
    profile: TeamRoleSlot | undefined;
  }> = [
    { label: "Owner", profile: team.owner },
    { label: "Co-owner", profile: team.coOwner },
    { label: "Captain", profile: team.captain },
    { label: "Marquee", profile: team.marquee },
  ];

  const rosterCapacity = 14;
  const rosterCount = team.playersOwnedCount;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 relative">
      <div>
        <Link href={ROUTES.TEAMS}>
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-white mb-2 uppercase tracking-widest text-xs font-bold px-0 hover:bg-transparent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Teams
          </Button>
        </Link>
      </div>

      <div
        className="bg-pitch-900 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row gap-8 items-center md:items-start"
        style={{ borderTopColor: color, borderTopWidth: 4 }}
      >
        <div
          className="absolute top-0 right-0 w-100 h-100 opacity-[0.08] pointer-events-none rounded-full blur-[80px]"
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
            <StatBox
              label="Total Points for Player Auction"
              value={team.pointsTotal}
            />
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

      <div className="bg-pitch-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
        <h3 className="text-xl font-heading font-bold uppercase tracking-widest text-slate-200 flex items-center gap-3">
          <Users className="w-6 h-6 text-slate-500" />
          Team Members
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {leadershipCards.map((card) => (
            <RoleProfileCard
              key={card.label}
              label={card.label}
              profile={card.profile}
              teamId={teamId}
            />
          ))}
        </div>
      </div>

      <div className="bg-pitch-900 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur shadow-2xl">
        <div className="p-6 md:px-8 border-b border-slate-800 flex items-center justify-between bg-black/20">
          <h3 className="text-xl font-heading font-bold uppercase tracking-widest text-slate-200 flex items-center gap-3">
            <Users className="w-6 h-6 text-slate-500" />
            Roster
          </h3>
          <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs font-mono font-bold uppercase tracking-widest">
            {rosterCount} / {rosterCapacity}
          </span>
        </div>

        {team.players && team.players.length > 0 ? (
          <div className="w-full">
            {/* Mobile Card List */}
            <div className="md:hidden flex flex-col gap-3 p-4">
              {team.players.map((player) => (
                <div
                  key={player.id}
                  className="bg-pitch-900/50 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3 cursor-pointer active:scale-[0.98] hover:bg-slate-800/40 hover:border-slate-700 transition-all hover:shadow-lg"
                  onClick={() => setSelectedPlayer(player as Player)}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-semibold text-slate-200 text-lg">
                      {player.name}
                    </div>
                    <div className="font-bold text-accent-gold font-mono text-xl">
                      {formatSoldAmount(player.transactionAmount)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-[10px] font-bold border border-slate-700 uppercase tracking-wider">
                      {player.position1}
                      {player.position2 ? ` / ${player.position2}` : ""}
                    </span>
                    <span className="px-2 py-1 bg-slate-900 text-slate-400 rounded text-[10px] font-bold border border-slate-700 uppercase tracking-wider">
                      {player.year || "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-500 uppercase tracking-widest text-xs font-bold pl-6 md:pl-8 py-5">
                      Player Name
                    </TableHead>
                    <TableHead className="text-slate-500 uppercase tracking-widest text-xs font-bold w-24">
                      Year
                    </TableHead>
                    <TableHead className="text-slate-500 uppercase tracking-widest text-xs font-bold w-37.5">
                      Position
                    </TableHead>
                    <TableHead className="text-slate-500 uppercase tracking-widest text-xs font-bold text-right pr-6 md:pr-8 w-50">
                      Paid
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.players.map((player) => (
                    <TableRow
                      key={player.id}
                      className="border-slate-800 hover:bg-slate-800/30 transition-colors cursor-pointer group"
                      onClick={() => setSelectedPlayer(player as Player)}
                    >
                      <TableCell className="font-bold text-slate-200 pl-6 md:pl-8 text-base py-4 group-hover:text-accent-gold transition-colors">
                        {player.name}
                      </TableCell>
                      <TableCell className="text-slate-400 font-mono text-xs font-bold uppercase tracking-wider">
                        {player.year || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-[10px] font-bold border border-slate-700 uppercase tracking-wider">
                          {player.position1}
                          {player.position2 ? ` / ${player.position2}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-6 md:pr-8 font-mono text-xl font-bold text-accent-gold drop-shadow-sm">
                        {formatSoldAmount(player.transactionAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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

      <PlayerDetailsDialog
        player={selectedPlayer}
        status="ALL"
        onOpenChange={(open) => !open && setSelectedPlayer(null)}
      />
    </div>
  );
}

function hasRoleContent(profile?: TeamRoleSlot): boolean {
  return Boolean(profile?.name?.trim() || profile?.imageUrl?.trim());
}

function RoleProfileCard({
  label,
  profile,
  teamId,
}: {
  label: string;
  profile: TeamRoleSlot | undefined;
  teamId: string;
}) {
  const hasContent = hasRoleContent(profile);
  const [isOpen, setIsOpen] = useState(false);
  const profileImageUrl = toDisplayImageUrl(profile?.imageUrl);
  const layoutIdBase = `role-${teamId}-${label.replace(/\s+/g, "-")}-${profile?.name?.replace(/\s+/g, "-") ?? "empty"}`;

  return (
    <>
      <motion.div
        layoutId={`${layoutIdBase}-card`}
        onClick={() => profileImageUrl && setIsOpen(true)}
        className={`relative overflow-hidden rounded-2xl border border-slate-800/80 bg-pitch-950/40 p-5 shadow-lg group ${
          profileImageUrl
            ? "cursor-pointer hover:bg-slate-800/40 hover:border-slate-700 hover:-translate-y-1 transition-all duration-300"
            : ""
        }`}
      >
        <motion.p
          layoutId={`${layoutIdBase}-label`}
          className="text-[10px] text-slate-500 uppercase tracking-[0.25em] font-bold"
        >
          {label}
        </motion.p>

        {hasContent ? (
          <div className="mt-4 min-h-[4.5rem] flex items-center gap-4">
            {profileImageUrl ? (
              <div className="relative size-16 shrink-0">
                <div className="absolute inset-0 bg-accent-gold/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                <motion.img
                  layoutId={`${layoutIdBase}-image`}
                  src={profileImageUrl}
                  alt={profile?.name || label}
                  className="relative size-16 rounded-full object-cover border-2 border-slate-700 bg-slate-800 z-10 shadow-xl"
                />
              </div>
            ) : (
              <div className="size-16 shrink-0 rounded-full border-2 border-slate-800 bg-pitch-950/70" />
            )}

            <div className="flex-1 min-h-[1.5rem] flex items-center">
              {profile?.name ? (
                <motion.p
                  layoutId={`${layoutIdBase}-name`}
                  className="text-[15px] font-bold text-slate-100 tracking-wide line-clamp-2"
                >
                  {profile.name}
                </motion.p>
              ) : (
                <span className="block h-5 w-1/2 bg-slate-800/50 rounded animate-pulse" />
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 min-h-[4.5rem] rounded-xl border border-dashed border-slate-800 bg-pitch-950/30 flex items-center justify-center">
            <span className="text-xs uppercase tracking-widest text-slate-600 font-bold">
              Unassigned
            </span>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {isOpen && profileImageUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              layoutId={`${layoutIdBase}-card`}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-slate-700 bg-pitch-950 shadow-2xl flex flex-col z-10"
            >
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 z-20 rounded-full bg-black/40 p-2 text-white/70 hover:bg-black/80 hover:text-white transition-all backdrop-blur-md"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="w-full relative aspect-square sm:aspect-[4/5] flex items-center justify-center bg-slate-900/50">
                <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-transparent to-transparent z-10 pointer-events-none" />
                <motion.img
                  layoutId={`${layoutIdBase}-image`}
                  src={profileImageUrl}
                  alt={profile?.name || label}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="w-full p-8 pt-0 bg-pitch-950 flex flex-col items-center gap-2 text-center relative z-20">
                <motion.p
                  layoutId={`${layoutIdBase}-label`}
                  className="text-[10px] text-accent-gold uppercase tracking-[0.3em] font-black mb-1"
                >
                  {label}
                </motion.p>
                <div className="h-px w-12 bg-accent-gold/30 mb-2 rounded-full" />
                <motion.p
                  layoutId={`${layoutIdBase}-name`}
                  className="text-2xl md:text-3xl font-black font-heading tracking-wider uppercase text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
                >
                  {profile?.name}
                </motion.p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
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
