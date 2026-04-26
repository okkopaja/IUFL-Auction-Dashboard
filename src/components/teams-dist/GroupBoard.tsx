"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { GroupName, TdTeam } from "@/types/teams-dist";

const GROUP_STYLES: Record<
  GroupName,
  { header: string; dot: string; card: string }
> = {
  A: {
    header: "text-violet-300 border-violet-700/40",
    dot: "bg-violet-500",
    card: "border-violet-800/30 hover:border-violet-600/50",
  },
  B: {
    header: "text-amber-300 border-amber-700/40",
    dot: "bg-amber-500",
    card: "border-amber-800/30 hover:border-amber-600/50",
  },
  C: {
    header: "text-emerald-300 border-emerald-700/40",
    dot: "bg-emerald-500",
    card: "border-emerald-800/30 hover:border-emerald-600/50",
  },
  D: {
    header: "text-sky-300 border-sky-700/40",
    dot: "bg-sky-500",
    card: "border-sky-800/30 hover:border-sky-600/50",
  },
};

function TeamSlot({
  team,
  index,
  groupName,
}: {
  team: TdTeam | null;
  index: number;
  groupName: GroupName;
}) {
  const style = GROUP_STYLES[groupName];

  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors duration-150 ${
        team
          ? `bg-slate-900/40 ${style.card}`
          : "border-dashed border-slate-800 bg-transparent"
      }`}
    >
      <span className="text-xs font-mono text-slate-600 w-4 shrink-0">
        {index + 1}
      </span>
      <AnimatePresence mode="wait">
        {team ? (
          <motion.div
            key={team.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="flex flex-1 items-center gap-2 min-w-0"
          >
            <span className={`size-2 shrink-0 rounded-full ${style.dot}`} />
            <span className="truncate text-sm font-medium text-slate-200">
              {team.name}
            </span>
            {team.country && (
              <span className="ml-auto shrink-0 text-xs text-slate-600">
                {team.country}
              </span>
            )}
          </motion.div>
        ) : (
          <motion.span
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-slate-700 italic"
          >
            Empty slot
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export function GroupBoard({
  groups,
}: {
  groups: Array<{
    groupName: string;
    teams: TdTeam[];
    isFull: boolean;
    capacity: number;
  }>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {groups.map((g) => {
        const gName = g.groupName as GroupName;
        const style = GROUP_STYLES[gName] ?? GROUP_STYLES.A;
        const slots = Array.from({ length: 4 }, (_, i) => g.teams[i] ?? null);

        return (
          <motion.div
            key={g.groupName}
            layout
            className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#0d1218]/60 p-4"
          >
            <div
              className={`flex items-center justify-between border-b pb-2 ${style.header}`}
            >
              <span className="text-sm font-bold uppercase tracking-widest">
                Group {g.groupName}
              </span>
              <span className="text-xs font-mono text-slate-600">
                {g.teams.length}/{g.capacity}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {slots.map((team, i) => (
                <TeamSlot
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable slot positions
                  key={i}
                  team={team}
                  index={i}
                  groupName={gName}
                />
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
