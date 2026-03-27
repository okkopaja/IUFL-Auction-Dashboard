import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Call at the top of any API route handler that requires authentication.
 * Returns a 401 NextResponse if the request has no valid Clerk session,
 * or null if auth passed (caller should proceed normally).
 *
 * @example
 * export async function POST(req: NextRequest) {
 *   const denied = await requireAuth();
 *   if (denied) return denied;
 *   // ... rest of handler
 * }
 */
export async function requireAuth(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  return null;
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return user.publicMetadata?.isAdmin === true;
}

export async function requireAdmin(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const admin = await isUserAdmin(userId);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  return null;
}
