"use client";

import { usePathname } from "next/navigation";

export function Attribution() {
  const pathname = usePathname();

  // Do not show on admin routes
  if (pathname?.startsWith("/v1/private/admin")) {
    return null;
  }

  // Only show on specific pages
  const isAllowedPath =
    pathname === "/" ||
    pathname?.includes("/teams") ||
    pathname?.includes("/players") ||
    pathname?.includes("/dashboard");

  if (!isAllowedPath) {
    return null;
  }

  const isRightAligned =
    pathname?.includes("/v1/public/players") ||
    pathname?.includes("/v1/public/teams");

  const isAuctionDashboard = pathname === "/v1/private/auction/dashboard";

  const positionClass = isAuctionDashboard
    ? "bottom-2 right-4 sm:bottom-3 sm:right-6 lg:right-8"
    : isRightAligned
      ? "top-2 right-6 sm:top-3 sm:right-8"
      : "top-2 left-6 sm:top-3 sm:left-8";

  return (
    <a
      href="https://github.com/okkopaja"
      target="_blank"
      rel="noopener noreferrer"
      style={{ zIndex: 9999 }}
      className={`fixed ${positionClass} flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-white/40 transition-colors hover:text-white drop-shadow-md pointer-events-auto`}
    >
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span>Made with</span>
        <span className="text-sm">🤖</span>
        <span>
          by{" "}
          <span className="text-white/60 hover:text-white transition-colors">
            github.com/okkopaja
          </span>
        </span>
      </span>
    </a>
  );
}
