import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { sessionId } = await auth();

  // If the user acquired an active session from signing up, log them out
  // so they are forced to log in again.
  if (sessionId) {
    const client = await clerkClient();
    await client.sessions.revokeSession(sessionId);
  }

  const url = new URL("/v1/public/sign-in?message=signup_success", req.url);
  return NextResponse.redirect(url);
}
