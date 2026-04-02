import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Routes that require an authenticated Clerk session.
 * - /v1/private/*  → admin and auction control surfaces
 */
const isProtectedRoute = createRouteMatcher(["/v1/private(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    // Triggers Clerk redirect-to-sign-in for unauthenticated users.
    // After sign-in, Clerk redirects back to the original URL.
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets.
    // This is the canonical pattern from Clerk docs for Next.js App Router.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes (so auth() works in route handlers)
    "/(api|trpc)(.*)",
  ],
};
