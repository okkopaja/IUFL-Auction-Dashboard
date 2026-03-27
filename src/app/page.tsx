"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#080a0f] text-white font-sans">
      {/* Techy Background Pattern */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#13161e_1px,transparent_1px),linear-gradient(to_bottom,#13161e_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <div className="z-10 flex flex-col items-center max-w-5xl px-6 text-center">
        {/* Subtext / Monospace label */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-6 flex space-x-3 items-center rounded-sm border border-white/5 bg-black/40 px-4 py-1.5 text-[0.65rem] sm:text-xs font-mono text-gray-400 backdrop-blur-md"
        >
          <span className="flex h-2 w-2 rounded-full bg-[#ccff00] shadow-[0_0_8px_#ccff00] animate-pulse" />
          <span className="tracking-[0.2em]">SYSTEM INITIALIZED // DRAFT MODE</span>
        </motion.div>

        {/* Main Heading Text */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] font-extrabold tracking-tighter text-white mb-6 leading-none"
        >
          IUFL 2026
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500 mt-2">
            PLAYER AUCTION
          </span>
        </motion.h1>

        {/* Call to Action Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12"
        >
          <Link
            href="/dashboard"
            className="group relative inline-flex items-center justify-center gap-3 rounded-none bg-[#ccff00] px-10 py-5 text-sm font-bold uppercase tracking-widest text-black transition-all hover:bg-[#e0ff33] active:scale-95 overflow-hidden ring-1 ring-white/10"
          >
            {/* Structural corner accents */}
            <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-black" />
            <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-black" />
            
            <span className="relative z-10 flex items-center gap-2">
              Proceed to Auction
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </motion.div>
      </div>

      {/* Decorative Ambient Glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ccff00] opacity-[0.03] blur-[120px]" />
    </main>
  );
}
