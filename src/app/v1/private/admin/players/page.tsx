import { ArrowLeft, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPlayersBlock } from "@/components/admin/players/AdminPlayersBlock";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Admin Players — IUFL 2026 Auction",
  description:
    "Dedicated player registry management for search, review, and profile inspection.",
  robots: { index: false, follow: false },
};

export default function AdminPlayersPage() {
  return (
    <div className="max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl border border-accent-gold/30 bg-accent-gold/10">
            <Users className="size-5 text-accent-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-slate-100">
              Players Registry Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Search players, inspect statuses, and open detailed profile views.
            </p>
          </div>
        </div>

        <Link href={ROUTES.ADMIN_DASHBOARD} className="block">
          <Button
            type="button"
            variant="outline"
            className="border-slate-700 bg-slate-900/30 text-slate-300 hover:border-slate-500 hover:bg-slate-800/60"
          >
            <ArrowLeft className="size-4 mr-1" />
            Back to Admin Dashboard
          </Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-pitch-900/50 backdrop-blur-md p-6 flex flex-col gap-5">
        <p className="text-sm text-slate-500 leading-relaxed">
          Manage player records in a focused workspace without crowding the main
          admin dashboard.
        </p>
        <AdminPlayersBlock />
      </div>
    </div>
  );
}
