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
          className="mt-12 flex w-full max-w-3xl flex-col items-center justify-center gap-6"
          suppressHydrationWarning
        >
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            <Link
              href={ROUTES.PLAYERS}
              className="group relative inline-flex min-h-14 items-center justify-between overflow-hidden rounded-none border border-[#ccff00]/45 bg-[#0d1218]/85 px-7 py-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[#ccff00] hover:bg-[#111821] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ccff00]/70"
              suppressHydrationWarning
            >
              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(204,255,0,0.15),transparent_55%)] opacity-75 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="absolute top-0 left-0 h-2 w-2 border-l-2 border-t-2 border-[#ccff00]" />
              <span className="absolute bottom-0 right-0 h-2 w-2 border-b-2 border-r-2 border-[#ccff00]" />

              <span className="relative z-10 flex flex-col items-start">
                <span className="text-[0.65rem] uppercase tracking-[0.35em] text-[#ccff00]/75">
                  Explore
                </span>
                <span className="mt-1 text-lg font-semibold uppercase tracking-[0.2em] text-white sm:text-xl">
                  Players
                </span>
              </span>

              <ChevronRight className="relative z-10 h-5 w-5 text-[#ccff00] transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            <Link
              href={ROUTES.TEAMS}
              className="group relative inline-flex min-h-14 items-center justify-between overflow-hidden rounded-none border border-[#ccff00]/45 bg-[#0d1218]/85 px-7 py-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[#ccff00] hover:bg-[#111821] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ccff00]/70"
              suppressHydrationWarning
            >
              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(204,255,0,0.15),transparent_55%)] opacity-75 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="absolute top-0 left-0 h-2 w-2 border-l-2 border-t-2 border-[#ccff00]" />
              <span className="absolute bottom-0 right-0 h-2 w-2 border-b-2 border-r-2 border-[#ccff00]" />

              <span className="relative z-10 flex flex-col items-start">
                <span className="text-[0.65rem] uppercase tracking-[0.35em] text-[#ccff00]/75">
                  Explore
                </span>
                <span className="mt-1 text-lg font-semibold uppercase tracking-[0.2em] text-white sm:text-xl">
                  Teams
                </span>
              </span>

              <ChevronRight className="relative z-10 h-5 w-5 text-[#ccff00] transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          {/*
            Direct landing-page navigation to auction views is disabled for now.
            The dashboard is accessed via direct URL links only.
          */}
        </motion.div>
      </div>

      {/* Decorative Ambient Glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ccff00] opacity-[0.03] blur-[120px]" />
    </main>
  );
}
