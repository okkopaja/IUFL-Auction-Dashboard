import { User } from "lucide-react";
import Image from "next/image";
import { toDisplayImageUrl } from "@/lib/imageUrl";
import type { Player } from "@/types";

export function PlayerCard({
  player,
  isFocusMode = false,
}: {
  player: Player | null;
  isFocusMode?: boolean;
}) {
  if (!player) return null;
  const playerImageUrl = toDisplayImageUrl(player.imageUrl);

  return (
    <div
      className={`w-full relative rounded-2xl overflow-hidden shadow-2xl bg-[#0f0f0f] border border-[#333] group transition-all duration-500 ease-out hover:shadow-[0_0_40px_rgba(255,215,0,0.15)] ${
        isFocusMode
          ? "max-w-[500px] md:max-w-[600px] lg:max-w-[700px] h-auto max-h-[85vh] aspect-[4/5] md:aspect-[3/4]"
          : "max-w-[300px] md:max-w-[360px] aspect-[3/4] md:aspect-[4/5]"
      }`}
    >
      {/* Background Image / Placeholder */}
      {playerImageUrl ? (
        <Image
          src={playerImageUrl}
          alt={player.name}
          fill
          className={`opacity-90 group-hover:opacity-100 transition-all duration-700 pointer-events-none ${
            isFocusMode
              ? "object-contain object-center scale-100"
              : "object-cover object-top group-hover:scale-105"
          }`}
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
      <div
        className={`absolute left-4 z-20 flex flex-col items-start gap-2 ${isFocusMode ? "top-6 md:top-8" : "top-4"}`}
      >
        <span
          className={`bg-black/60 backdrop-blur-md text-slate-200 border border-slate-700/50 rounded-md font-bold uppercase tracking-widest leading-none ${isFocusMode ? "px-4 py-2 text-base md:text-lg lg:text-xl" : "px-3 md:px-4 py-1.5 text-sm md:text-base"}`}
        >
          Stream: {player.stream ?? "Unspecified"}
        </span>
        {player.year && (
          <span
            className={`bg-black/60 backdrop-blur-md text-slate-400 border border-slate-700/50 rounded-md uppercase font-mono tracking-wider leading-none ${isFocusMode ? "px-3 py-1.5 text-sm md:text-base" : "px-2.5 md:px-3 py-1 text-xs md:text-sm"}`}
          >
            {player.year}
          </span>
        )}
      </div>

      {/* Player Info (Bottom) */}
      <div
        className={`absolute bottom-0 left-0 w-full z-20 flex flex-col ${isFocusMode ? "p-8 md:p-10" : "p-6"}`}
      >
        {/* Positions */}
        <div className="flex gap-2 mb-2">
          <span
            className={`text-accent-gold font-mono tracking-widest uppercase font-semibold drop-shadow-md ${isFocusMode ? "text-base md:text-xl" : "text-sm"}`}
          >
            {player.position1}
            {player.position2 && (
              <span className="text-slate-400"> / {player.position2}</span>
            )}
          </span>
        </div>

        {/* Name */}
        <h2
          className={`leading-none font-black text-white tracking-widest uppercase mb-1 drop-shadow-lg ${isFocusMode ? "text-5xl md:text-6xl lg:text-[5rem]" : "text-3xl md:text-4xl"}`}
        >
          {player.name || "Unnamed Player"}
        </h2>
      </div>

      {/* Subtle shine effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-30" />
    </div>
  );
}
