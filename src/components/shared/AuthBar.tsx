"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Top-right auth cluster for the public /dashboard page.
 *
 * - Unauthenticated → ThemeToggle + gold "Sign In" button (Clerk modal)
 * - Authenticated   → ThemeToggle + Clerk UserButton (avatar/dropdown)
 *
 * Uses useAuth() hook (client-safe) instead of the server-only <Show> component.
 */
export function AuthBar() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />

      {/* Skeleton while Clerk initialises to prevent layout shift */}
      {!isLoaded && (
        <div className="size-8 rounded-full bg-slate-700/40 animate-pulse" />
      )}

      {isLoaded && !isSignedIn && (
        <Link
          href="/sign-in"
          id="sign-in-btn"
          className="
            group flex items-center gap-2 px-4 py-1.5 rounded-full
            border border-accent-gold/40 bg-accent-gold/10
            text-accent-gold hover:bg-accent-gold/20 hover:border-accent-gold/70
            text-sm font-semibold tracking-wide
            transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60
          "
        >
          <LogIn className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          <span>Sign In</span>
        </Link>
      )}

      {isLoaded && isSignedIn && (
        <UserButton
          appearance={{
            elements: {
              avatarBox:
                "size-8 ring-2 ring-accent-gold/40 hover:ring-accent-gold/80 transition-all duration-200 rounded-full",
            },
          }}
        />
      )}
    </div>
  );
}
