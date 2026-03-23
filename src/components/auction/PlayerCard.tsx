import { User } from "lucide-react";
import Image from "next/image";
import type { Player } from "@/types";

export function PlayerCard({ player }: { player: Player | null }) {
  if (!player) return null;
  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center p-4">
      {/* Player PIC (Circle) */}
      <div className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden border-4 border-slate-700/50 relative shadow-2xl mb-8 flex-shrink-0 bg-pitch-900 group">
        <div className="absolute inset-0 bg-gradient-to-t from-pitch-900/40 to-transparent z-10" />
        {player.imageUrl ? (
          <Image
            src={player.imageUrl}
            alt={player.name}
            fill
            className="object-cover object-top opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600 bg-pitch-800">
            <User className="w-24 h-24" />
          </div>
        )}
      </div>

      {/* Player Details Box */}
      <div className="w-full max-w-sm rounded-[2rem] border border-slate-700/50 bg-pitch-900/60 p-6 md:p-8 flex flex-col gap-4 items-center text-center shadow-xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-[-10%] w-32 h-32 bg-accent-gold/5 blur-[80px] rounded-full pointer-events-none" />

        <h2 className="text-3xl md:text-5xl font-heading font-black text-white tracking-widest uppercase drop-shadow-md leading-tight">
          {player.name}
        </h2>

        <div className="flex flex-col gap-3 mt-2 w-full items-center">
          <div className="flex gap-2 justify-center w-full">
            <span className="px-4 py-1.5 bg-accent-gold/10 text-accent-gold shadow-[0_0_15px_-3px_rgba(245,200,66,0.2)] border border-accent-gold/30 rounded-full text-sm font-bold uppercase tracking-wider backdrop-blur-md">
              {player.position}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 mt-2 w-full">
            <span className="text-slate-400 font-mono text-sm uppercase tracking-wider">
              Base Price:
            </span>
            <span className="text-lg font-bold text-white tracking-widest">
              ♦ {player.basePrice}
            </span>
          </div>

          {player.year && (
            <div className="mt-2 text-slate-500 font-mono text-xs uppercase tracking-widest flex gap-2">
              <span>Class:</span>
              <span className="text-slate-300 font-bold">{player.year}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
