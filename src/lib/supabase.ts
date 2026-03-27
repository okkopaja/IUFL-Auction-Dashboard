import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export async function getSupabaseServerClient() {
  const { getToken } = await auth();
  let token: string | null = null;
  try {
    token = await getToken({ template: "supabase" });
  } catch (err) {
    // If the JWT template is missing or fails, we continue without it.
    // The client will just use the ANON key.
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      global: {
        headers: {
          // If a token exists, add it to auth headers via Clerk.
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    },
  );
}

export function createClerkSupabaseClient(clerkToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${clerkToken}`,
        },
      },
    },
  );
}

/**
 * Server-side admin client that bypasses RLS.
 * Only use in API routes already protected by requireAuth().
 */
export function getSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } },
  );
}
