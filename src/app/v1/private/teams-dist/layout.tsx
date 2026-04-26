import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isUserAdmin } from "@/lib/auth";

/**
 * Server-side layout guard for /v1/private/teams-dist/* routes.
 * Requires admin or superadmin role — same as the existing admin layout pattern.
 */
export default async function TeamsDistLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/v1/public/sign-in");
  }

  const admin = await isUserAdmin(userId, sessionClaims);
  if (!admin) {
    redirect("/v1/private/auction/dashboard");
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-slate-100 flex flex-col">
      {children}
    </div>
  );
}
