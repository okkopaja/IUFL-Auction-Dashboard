"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { BackgroundBeams } from "@/components/ui/background-beams";

export default function Home() {
  return (
    <div className="relative flex min-h-screen-safe w-full flex-col items-center justify-center overflow-x-hidden bg-neutral-950 text-foreground font-sans antialiased">
      <div className="z-10 flex flex-col items-center max-w-5xl px-6 text-center">
        {/* Main Heading Text */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-4 flex flex-col items-center justify-center pt-8"
          suppressHydrationWarning
        >
          <h1 className="text-center font-black uppercase italic leading-[0.85] tracking-tighter sm:-skew-x-[4deg]">
            <span className="block text-6xl text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] sm:text-8xl md:text-9xl lg:text-[9rem]">
              IUFL{" "}
              <span className="text-transparent outline-none [-webkit-text-stroke:2px_white] block sm:inline-block">
                2026
              </span>
            </span>
            <span className="relative mt-4 block bg-gradient-to-b from-[#ccff00] via-[#e6ff66] to-[#88aa00] bg-clip-text text-5xl text-transparent drop-shadow-[0_10px_30px_rgba(204,255,0,0.5)] sm:text-7xl md:text-8xl lg:text-[8rem]">
              PLAYER AUCTION
              {/* Decorative accent slash */}
              <span className="absolute -bottom-2 -top-0 -left-6 hidden w-3 bg-[#ccff00] sm:block lg:-left-10 lg:w-4" />
            </span>
          </h1>
        </motion.div>

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
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-[0.05] blur-[120px]" />

      <BackgroundBeams />
    </div>
  );
}
