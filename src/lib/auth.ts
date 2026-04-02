import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

type UserRole = "none" | "admin" | "superadmin";

const ROLE_CACHE_TTL_MS = 30_000;
const roleCache = new Map<string, { role: UserRole; expiresAt: number }>();

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function readRole(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim().toLowerCase();
}

function readBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function readCachedRole(userId: string): UserRole | null {
  const cached = roleCache.get(userId);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    roleCache.delete(userId);
    return null;
  }

  return cached.role;
}

function writeCachedRole(userId: string, role: UserRole): void {
  roleCache.set(userId, {
    role,
    expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
  });
}

function extractRoleMetadata(value: unknown): Record<string, unknown> {
  const source = asRecord(value);
  const picked: Record<string, unknown> = {};

  if ("role" in source && source.role !== undefined) {
    picked.role = source.role;
  }

  if ("isAdmin" in source && source.isAdmin !== undefined) {
    picked.isAdmin = source.isAdmin;
  }

  if ("isSuperAdmin" in source && source.isSuperAdmin !== undefined) {
    picked.isSuperAdmin = source.isSuperAdmin;
  }

  return picked;
}

function hasRoleMetadata(metadata: Record<string, unknown>): boolean {
  return (
    "role" in metadata || "isAdmin" in metadata || "isSuperAdmin" in metadata
  );
}

function resolveRoleFromSessionClaims(sessionClaims: unknown): UserRole | null {
  const claims = asRecord(sessionClaims);

  const publicMetadata = {
    ...extractRoleMetadata(claims),
    ...extractRoleMetadata(claims.metadata),
    ...extractRoleMetadata(claims.public_metadata),
    ...extractRoleMetadata(claims.publicMetadata),
  };

  const privateMetadata = {
    ...extractRoleMetadata(claims.private_metadata),
    ...extractRoleMetadata(claims.privateMetadata),
  };

  if (!hasRoleMetadata(publicMetadata) && !hasRoleMetadata(privateMetadata)) {
    return null;
  }

  return resolveUserRole({
    publicMetadata,
    privateMetadata,
  });
}

function readErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  if (!("status" in error)) return null;

  const { status } = error as { status?: unknown };
  return typeof status === "number" ? status : null;
}

function isLikelyCredentialError(error: unknown): boolean {
  const status = readErrorStatus(error);
  if (status !== null && [400, 401, 403, 404, 422].includes(status)) {
    return true;
  }

  if (!error || typeof error !== "object") return false;
  if (!("message" in error)) return false;

  const { message } = error as { message?: unknown };
  return (
    typeof message === "string" &&
    /(password|credential|verify|verification)/i.test(message)
  );
}

function resolveUserRole(user: {
  publicMetadata: unknown;
  privateMetadata: unknown;
}): UserRole {
  const publicMetadata = asRecord(user.publicMetadata);
  const privateMetadata = asRecord(user.privateMetadata);

  const publicRole = readRole(publicMetadata.role);
  const privateRole = readRole(privateMetadata.role);

  const isSuperAdmin =
    publicRole === "superadmin" ||
    privateRole === "superadmin" ||
    readBoolean(publicMetadata.isSuperAdmin) ||
    readBoolean(privateMetadata.isSuperAdmin);

  if (isSuperAdmin) {
    return "superadmin";
  }

  const isAdmin =
    publicRole === "admin" ||
    privateRole === "admin" ||
    readBoolean(publicMetadata.isAdmin) ||
    readBoolean(privateMetadata.isAdmin);

  return isAdmin ? "admin" : "none";
}

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

export async function getUserRole(
  userId: string,
  sessionClaims?: unknown,
): Promise<UserRole> {
  const roleFromClaims = resolveRoleFromSessionClaims(sessionClaims);
  if (roleFromClaims !== null) {
    return roleFromClaims;
  }

  const cachedRole = readCachedRole(userId);
  if (cachedRole) {
    return cachedRole;
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = resolveUserRole({
    publicMetadata: user.publicMetadata,
    privateMetadata: user.privateMetadata,
  });

  writeCachedRole(userId, role);
  return role;
}

export async function isUserAdmin(
  userId: string,
  sessionClaims?: unknown,
): Promise<boolean> {
  const role = await getUserRole(userId, sessionClaims);
  return role === "admin" || role === "superadmin";
}

export async function isUserSuperAdmin(
  userId: string,
  sessionClaims?: unknown,
): Promise<boolean> {
  const role = await getUserRole(userId, sessionClaims);
  return role === "superadmin";
}

async function requireRole(
  authorize: (role: UserRole) => boolean,
): Promise<NextResponse | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const role = await getUserRole(userId, sessionClaims);
  if (!authorize(role)) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  return null;
}

export async function requireAuctionAccess(): Promise<NextResponse | null> {
  return requireRole((role) => role === "admin" || role === "superadmin");
}

export async function requireSuperAdmin(): Promise<NextResponse | null> {
  return requireRole((role) => role === "superadmin");
}

export async function requireAdmin(): Promise<NextResponse | null> {
  // Backward-compatible alias used by older endpoints.
  return requireAuctionAccess();
}

export async function requireCurrentUserPassword(
  password: string,
): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const safePassword = typeof password === "string" ? password : "";
  if (safePassword.length === 0) {
    return NextResponse.json(
      { success: false, error: "Password is required" },
      { status: 400 },
    );
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  if (!user.passwordEnabled) {
    return NextResponse.json(
      {
        success: false,
        error:
          "This account does not have a password configured. Add a password to your account before resetting the session.",
      },
      { status: 412 },
    );
  }

  try {
    await client.users.verifyPassword({ userId, password: safePassword });
  } catch (error) {
    if (isLikelyCredentialError(error)) {
      return NextResponse.json(
        { success: false, error: "Password confirmation failed" },
        { status: 401 },
      );
    }

    logger.error("Failed to verify password for secure admin action", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to verify password. Please try again.",
      },
      { status: 500 },
    );
  }

  return null;
}
