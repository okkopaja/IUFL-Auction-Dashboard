import { User } from "lucide-react";
import Image from "next/image";
import type { Player } from "@/types";

export function PlayerCard({ player }: { player: Player | null }) {
  if (!player) return null;
  return (
    <div className="w-full max-w-[360px] aspect-[4/5] relative rounded-2xl overflow-hidden shadow-2xl bg-[#0f0f0f] border border-[#333] group transition-all duration-300">
      {/* Background Image / Placeholder */}
      {player.imageUrl ? (
        <Image
          src={player.imageUrl}
          alt={player.name}
          fill
          className="object-cover object-top opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 pointer-events-none"
          sizes="(max-width: 768px) 100vw, 400px"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-[#333] bg-[#0a0a0a] inset-0 absolute">
          <User className="w-32 h-32 opacity-20" />
        </div>
      )}

      {/* Gradient Overlay for Text Visibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />

      {/* Top Badges */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-slate-200 border border-slate-700/50 rounded-md text-[10px] font-bold uppercase tracking-widest">
          Base: ♦ {player.basePrice}
        </span>
        {player.year && (
          <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-slate-300 border border-slate-700/50 rounded-md text-[10px] uppercase font-mono tracking-widest">
            {player.year}
          </span>
        )}
      </div>

      {/* Player Info (Bottom) */}
      <div className="absolute bottom-0 left-0 w-full p-6 z-20 flex flex-col">
        {/* Positions */}
        <div className="flex gap-2 mb-2">
          <span className="text-accent-gold font-mono text-sm tracking-widest uppercase font-semibold drop-shadow-md">
            {player.position1}
            {player.position2 && (
              <span className="text-slate-400"> / {player.position2}</span>
            )}
          </span>
        </div>

        {/* Name */}
        <h2 className="text-4xl leading-none font-black text-white tracking-widest uppercase mb-1">
          {player.name}
        </h2>
      </div>

      {/* Subtle shine effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-30" />
    </div>
  );
}
