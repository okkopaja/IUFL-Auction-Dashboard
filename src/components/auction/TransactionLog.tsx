import { TEAM_COLORS } from "@/lib/constants";
import type { Transaction } from "@/types";
import { TeamLogo } from "../shared/TeamLogo";

export function TransactionLog({ logs }: { logs: Transaction[] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6 bg-pitch-900 border border-slate-800 rounded-2xl backdrop-blur">
        <span className="text-slate-500 font-mono text-sm uppercase tracking-widest">
          No transactions yet
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-pitch-900 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur relative">
      <div className="flex items-center justify-between p-3 px-5 border-b border-slate-800/50 bg-pitch-950/40 absolute top-0 left-0 right-0 z-10 backdrop-blur-md">
        <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold">
          Recent Signings
        </h3>
      </div>

      <div className="flex-1 overflow-x-auto flex items-center gap-4 px-5 pt-14 pb-4 scrollbar-hide">
        {logs.map((log) => {
          const color = TEAM_COLORS[log.team.shortCode] || "#ffffff";
          return (
            <div
              key={log.id}
              className="flex-shrink-0 flex items-center justify-between w-[260px] bg-pitch-950/50 rounded-xl p-3 border border-slate-800 transition-all hover:bg-slate-800/30"
              style={{ borderLeftColor: color, borderLeftWidth: "4px" }}
            >
              <div className="flex items-center gap-3">
                <TeamLogo
                  domain={log.team.domain}
                  name={log.team.name}
                  size={32}
                />
                <div className="flex flex-col">
                  <span
                    className="text-sm font-bold text-slate-200 truncate max-w-[100px]"
                    title={log.player.name}
                  >
                    {log.player.name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                    {log.team.shortCode}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end pl-2">
                <span className="text-base font-mono font-bold text-accent-gold drop-shadow-sm">
                  {log.amount}
                </span>
                <span className="text-[9px] text-slate-500 font-mono uppercase">
                  Sold
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
