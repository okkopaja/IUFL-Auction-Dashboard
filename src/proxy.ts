import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Routes that require an authenticated Clerk session.
 * - /auction and all sub-paths  → live auction area
 * - /admin and all sub-paths    → admin panel (not linked anywhere; URL-only access)
 */
const isProtectedRoute = createRouteMatcher(["/auction(.*)", "/admin(.*)"]);

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
