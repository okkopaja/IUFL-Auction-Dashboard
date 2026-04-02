import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isUserAdmin } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/v1/public/sign-in");
  }

  const canAccessAuctionAreas = await isUserAdmin(userId, sessionClaims);
  if (!canAccessAuctionAreas) {
    redirect("/v1/public/players");
  }

  return <>{children}</>;
}
