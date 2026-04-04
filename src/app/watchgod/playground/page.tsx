import type { Metadata } from "next";
import { WatcherTeamPlayground } from "@/components/watchgod/WatcherTeamPlayground";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Watcher Team Playground - IUFL 2026 Auction",
  description:
    "Superadmin Sporting CP playground for non-persistent watcher simulations.",
  robots: { index: false, follow: false },
};

export default function WatchgodPlaygroundPage() {
  return <WatcherTeamPlayground />;
}
