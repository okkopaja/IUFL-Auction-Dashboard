import type { Metadata } from "next";
import { AdminDashboardView } from "@/components/admin/AdminDashboardView";

export const metadata: Metadata = {
  title: "Admin — IUFL 2026 Auction",
  description:
    "Restricted admin control panel for the IUFL 2026 Player Auction.",
  // Prevent search engines from indexing this page
  robots: { index: false, follow: false },
};

/**
 * Admin dashboard page — /v1/private/admin/dashboard
 *
 * Auth is handled in two layers:
 *  1. proxy.ts  → redirects unauthenticated requests before this page renders
 *  2. admin/layout.tsx → server-side fallback redirect (defence-in-depth)
 *
 * This page itself is a thin shell; all interactive logic lives in
 * AdminDashboardView (client component).
 */
export default function AdminDashboardPage() {
  return <AdminDashboardView />;
}
