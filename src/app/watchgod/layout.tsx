import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isUserSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WatchgodLayout({
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

  return <>{children}</>;
}
