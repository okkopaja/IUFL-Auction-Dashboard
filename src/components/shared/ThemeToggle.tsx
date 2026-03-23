"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="size-9" />;

  const cycle = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const Icon = theme === "light" ? Sun : Moon;

  const label = theme === "light" ? "Light mode" : "Dark mode";

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${label} (click to cycle)`}
      className="
        group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full
        border border-border/60 bg-card/60 backdrop-blur
        text-muted-foreground hover:text-foreground
        hover:bg-card hover:border-border
        transition-all duration-200 text-xs font-medium
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
      "
    >
      <Icon className="size-3.5 transition-transform duration-200 group-hover:scale-110" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
