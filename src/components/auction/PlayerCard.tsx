"use client";

import { User } from "lucide-react";
import { motion } from "framer-motion";
import { toDisplayImageUrl } from "@/lib/imageUrl";
import { cn } from "@/lib/utils";
import type { Player } from "@/types";

const POSITION_COLORS: Record<string, string> = {
  GK: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  DEF: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  MID: "text-green-400 bg-green-400/10 border-green-400/30",
  ATT: "text-red-400 bg-red-400/10 border-red-400/30",
  FWD: "text-red-400 bg-red-400/10 border-red-400/30",
};

export function PlayerCard({
  player,
  isFocusMode = false,
}: {
  player: Player | null;
  isFocusMode?: boolean;
}) {
  if (!player) return null;
  const playerImageUrl = toDisplayImageUrl(player.imageUrl);

  const pos1 = player.position1;
  const pos2 = player.position2;

  const pos1Class =
    POSITION_COLORS[pos1?.toUpperCase()] ??
    "text-slate-400 bg-slate-400/10 border-slate-400/30";
  const pos2Class = pos2
    ? (POSITION_COLORS[pos2.toUpperCase()] ??
      "text-slate-400 bg-slate-400/10 border-slate-400/30")
    : null;

  return (
    <div
      className={cn(
        "w-full relative overflow-hidden rounded-3xl border border-slate-700 bg-pitch-950 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col z-10 transition-all duration-500 ease-out hover:shadow-[0_0_40px_rgba(255,215,0,0.15)] group mx-auto",
        isFocusMode
          ? "max-w-md sm:max-w-lg md:max-w-xl h-auto max-h-[90vh]"
          : "max-w-[300px] md:max-w-[360px] max-h-[480px]",
      )}
    >
      <div
        className={cn(
          "w-full relative flex-1 flex items-center justify-center bg-slate-900/50 overflow-hidden",
          isFocusMode ? "min-h-[40vh]" : "min-h-[250px] md:min-h-[300px]",
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-transparent to-transparent z-10 pointer-events-none group-hover:opacity-80 transition-opacity duration-500" />

        {playerImageUrl ? (
          <img
            src={playerImageUrl}
            alt={player.name}
            className={cn(
              "w-full h-full decoding-async group-hover:scale-105 transition-transform duration-700",
              isFocusMode
                ? "object-contain max-h-[60vh]"
                : "object-contain max-h-[300px]",
            )}
            decoding="async"
          />
        ) : (
          <div className="flex items-center justify-center text-slate-700 font-black h-full w-full">
            <User
              className={cn(
                "opacity-20",
                isFocusMode ? "w-32 h-32" : "w-16 h-16 md:w-20 md:h-20",
              )}
            />
          </div>
        )}
      </div>

      <div
        className={cn(
          "w-full shrink-0 bg-pitch-950 flex flex-col items-center gap-2 text-center relative z-20 pb-6",
          isFocusMode ? "p-6 pt-0" : "p-4 pt-0",
        )}
      >
        <p className="text-[10px] text-accent-gold uppercase tracking-[0.3em] font-black mb-1">
          {isFocusMode ? "Current Player" : "Next In Line"}
        </p>
        <div className="h-px w-12 bg-accent-gold/30 mb-2 rounded-full" />
        <h3
          className={cn(
            "font-black font-heading tracking-wider uppercase text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]",
            isFocusMode
              ? "text-4xl md:text-5xl lg:text-[4rem] leading-none mb-2"
              : "text-2xl mb-1",
          )}
        >
          {player.name || "Unnamed Player"}
        </h3>

        <div className="flex flex-wrap justify-center gap-2 mt-2 w-full px-2">
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border shadow-sm",
              pos1Class,
              isFocusMode && "px-4 py-1.5 text-xs",
            )}
          >
            {pos1}
          </span>
          {pos2 && (
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border shadow-sm",
                pos2Class,
                isFocusMode && "px-4 py-1.5 text-xs",
              )}
            >
              {pos2}
            </span>
          )}
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border text-slate-300 bg-slate-800/30 border-slate-700/50 shadow-sm",
              isFocusMode && "px-4 py-1.5 text-xs",
            )}
          >
            {player.stream || "N/A"}
          </span>
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border text-slate-300 bg-slate-800/30 border-slate-700/50 shadow-sm",
              isFocusMode && "px-4 py-1.5 text-xs",
            )}
          >
            {player.year || "N/A"}
          </span>
        </div>
      </div>

      {/* SOLD Stamp */}
      {player.status === "SOLD" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 overflow-hidden select-none bg-black/40 backdrop-blur-[2px]"
        >
          {/* Subtle flare effect */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
            animate={{ opacity: [0, 0.6, 0], scale: 2.5, rotate: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[20%] bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent blur-[30px]"
          />

          <motion.div
            initial={{ scale: 3, opacity: 0, rotate: 0 }}
            animate={{ scale: 1, opacity: 1, rotate: -12 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 20,
              delay: 0.1,
            }}
            className="relative flex flex-col items-center z-10"
          >
            {/* Glow / blur effect behind */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.3, opacity: [0, 1, 0] }}
              transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
              className="absolute inset-0 border-[12px] border-red-600 rounded-3xl blur-[16px] bg-red-600/40"
            />

            <div className="relative border-[6px] md:border-8 border-red-600 px-6 md:px-10 py-2 md:py-4 rounded-3xl bg-black/50 backdrop-blur-md shadow-[0_0_40px_rgba(220,38,38,0.6)_inset,0_0_30px_rgba(220,38,38,0.5)]">
              <span className="font-heading font-black text-5xl sm:text-7xl md:text-[6rem] leading-none tracking-widest text-red-500 uppercase drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)]">
                Sold
              </span>
            </div>

            {player.transactionAmount && (
              <motion.div
                initial={{ y: 30, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.4,
                  type: "spring",
                  stiffness: 300,
                  damping: 15,
                }}
                className="absolute -bottom-8 md:-bottom-10 left-0 right-0 flex justify-center text-center"
              >
                <div className="relative inline-block z-20">
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 2, 0], opacity: [0, 0.8, 0] }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="absolute inset-0 bg-yellow-400 blur-xl rounded-full"
                  />
                  <div className="relative bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-600 text-black font-black px-6 py-2 rounded-full text-base md:text-lg tracking-wider shadow-[0_8px_20px_rgba(0,0,0,0.8)] border border-yellow-200/80 uppercase">
                    {player.team?.shortCode
                      ? `${player.team.shortCode} • `
                      : ""}
                    {player.transactionAmount} pts
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Subtle shine effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-30" />
    </div>
  );
}
