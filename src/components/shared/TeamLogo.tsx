"use client";

import { getTeamLogoUrl } from "@/lib/brandfetch";
import { useState } from "react";

interface TeamLogoProps {
  domain: string;
  name: string;
  size?: number;
  className?: string;
}

export function TeamLogo({
  domain,
  name,
  size = 48,
  className = "",
}: TeamLogoProps) {
  const [errored, setErrored] = useState(false);
  const logoUrl = getTeamLogoUrl(domain, "icon", "light", size);

  const initial = name?.charAt(0).toUpperCase() ?? "?";

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      {logoUrl && !errored ? (
        // Use plain <img> — Brandfetch CDN URLs already deliver optimised WebP/PNG
        // and require the ?c= client-id param to be sent by the browser directly.
        // next/image proxies server-side and strips query-params, causing null responses.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${name} logo`}
          width={size}
          height={size}
          className="object-contain w-full h-full"
          onError={() => setErrored(true)}
        />
      ) : (
        <div
          className="w-full h-full bg-pitch-800 flex items-center justify-center text-xs font-bold text-slate-300 select-none"
          aria-label={`${name} logo placeholder`}
        >
          {initial}
        </div>
      )}
    </div>
  );
}
