import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isUserAdmin } from "@/lib/auth";

/**
 * Server-side layout guard for all /admin/* routes.
 *
 * This is the second line of defence (proxy.ts is the first).  Even if someone
 * somehow bypasses the proxy, this will server-side redirect them away.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/dashboard");
  }

  const admin = await isUserAdmin(userId);
  if (!admin) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-pitch-950 text-slate-100 flex flex-col">
      {children}
    </div>
  );
}
