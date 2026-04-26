import type { Metadata } from "next";
import { TournamentsView } from "@/components/teams-dist/TournamentsView";

export const metadata: Metadata = {
  title: "Teams Draw — IUFL 2026",
  description: "UCL-style 16-team group draw manager for tournament organisers.",
  robots: { index: false, follow: false },
};

export default function TeamsDistPage() {
  return <TournamentsView />;
}
