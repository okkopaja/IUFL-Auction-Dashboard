import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isUserSuperAdmin } from "@/lib/auth";

/**
 * Server-side layout guard for all /v1/private/admin/* routes.
 *
 * This is the second line of defence (proxy.ts is the first).  Even if someone
 * somehow bypasses the proxy, this will server-side redirect them away.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/v1/public/sign-in");
  }

  const superAdmin = await isUserSuperAdmin(userId, sessionClaims);
  if (!superAdmin) {
    redirect("/v1/private/auction/dashboard");
  }

  return (
    <div className="min-h-screen bg-pitch-950 text-slate-100 flex flex-col">
      {children}
    </div>
  );
}
