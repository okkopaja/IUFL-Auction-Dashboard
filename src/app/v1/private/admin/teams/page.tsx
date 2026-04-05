import { ArrowLeft, Shield } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminTeamsBlock } from "@/components/admin/teams/AdminTeamsBlock";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Admin Teams — IUFL 2026 Auction",
  description:
    "Dedicated team and squad management for roles, points, and player assignment.",
  robots: { index: false, follow: false },
};

export default function AdminTeamsPage() {
  return (
    <div className="max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl border border-accent-blue/30 bg-accent-blue/10">
            <Shield className="size-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-slate-100">
              Teams Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage team roles, total points, and squad player assignments.
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
          Drop an image into a role card to upload it to Supabase Storage. If an
          image already exists, you can preview it and use Edit Image to replace
          it. You can also add UNSOLD players to team rosters with an amount and
          remove sold players back to UNSOLD with reversal.
        </p>
        <AdminTeamsBlock />
      </div>
    </div>
  );
}
