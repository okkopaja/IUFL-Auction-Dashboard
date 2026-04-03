"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

export default function Home() {
  return (
    <main className="relative flex min-h-screen-safe w-full flex-col items-center justify-center overflow-x-hidden bg-[#080a0f] text-white font-sans">
      {/* Techy Background Pattern */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#13161e_1px,transparent_1px),linear-gradient(to_bottom,#13161e_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <div className="z-10 flex flex-col items-center max-w-5xl px-6 text-center">
        {/* Main Heading Text */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] font-extrabold tracking-tighter text-white mb-6 leading-none"
          suppressHydrationWarning
        >
          IUFL 2026
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500 mt-2">
            PLAYER AUCTION
          </span>
        </motion.h1>

        {/* Call to Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 flex flex-col items-center justify-center gap-8"
          suppressHydrationWarning
        >
          {/* Secondary Links Row */}
          <div className="flex flex-row items-center justify-center gap-6 sm:gap-12">
            <Link
              href={ROUTES.PLAYERS}
              className="group relative px-6 py-3 font-sans text-xl sm:text-2xl uppercase tracking-widest text-slate-300 hover:text-white transition-colors"
              suppressHydrationWarning
            >
              Players
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#ccff00] transition-all group-hover:w-full" />
            </Link>

            <Link
              href={ROUTES.TEAMS}
              className="group relative px-6 py-3 font-sans text-xl sm:text-2xl uppercase tracking-widest text-slate-300 hover:text-white transition-colors"
              suppressHydrationWarning
            >
              Teams
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#ccff00] transition-all group-hover:w-full" />
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <Link
              href={ROUTES.PUBLIC_AUCTION}
              className="group relative inline-flex items-center justify-center gap-3 rounded-none bg-[#ccff00] px-10 py-5 text-sm font-bold uppercase tracking-widest text-black transition-all hover:bg-[#e0ff33] active:scale-95 overflow-hidden ring-1 ring-white/10"
              suppressHydrationWarning
            >
              {/* Structural corner accents */}
              <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-black" />
              <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-black" />

              <span className="relative z-10 flex items-center gap-2">
                Auction View
                <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>

            <Link
              href={ROUTES.AUCTION}
              className="group relative inline-flex items-center justify-center gap-3 rounded-none border border-[#ccff00]/40 bg-transparent px-10 py-5 text-sm font-bold uppercase tracking-widest text-[#ccff00] transition-all hover:bg-[#ccff00]/10 active:scale-95 overflow-hidden ring-1 ring-white/10"
              suppressHydrationWarning
            >
              {/* Structural corner accents */}
              <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#ccff00]" />
              <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#ccff00]" />

              <span className="relative z-10 flex items-center gap-2">
                Auction Dashboard
                <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Decorative Ambient Glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ccff00] opacity-[0.03] blur-[120px]" />
    </main>
  );
}
