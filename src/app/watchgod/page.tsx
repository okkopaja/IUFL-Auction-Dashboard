import type { Metadata } from "next";
import { WatchgodView } from "@/components/watchgod/WatchgodView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Watchgod — IUFL 2026 Auction",
  description:
    "Superadmin Sporting CP live auction monitor with progression queue and team bid capacity.",
  robots: { index: false, follow: false },
};

export default function WatchgodPage() {
  return <WatchgodView />;
}
