import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isUserAdmin } from "@/lib/auth";

export default async function AuctionLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/v1/public/sign-in");
  }

  const canAccessAuction = await isUserAdmin(userId, sessionClaims);
  if (!canAccessAuction) {
    redirect("/v1/public/players");
  }

  return <>{children}</>;
}
