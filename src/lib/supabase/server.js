import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseConfig,
  hasPublicSupabaseConfig,
  hasServerSupabaseConfig,
} from "@/lib/supabase/config";
import { getSessionCookieOptions } from "@/lib/supabase/sessionCookies";

export async function createSessionClient() {
  if (!hasPublicSupabaseConfig()) return null;
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookieOptions: getSessionCookieOptions(await headers()),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot mutate cookies. The /admin proxy persists
          // refreshed sessions before rendering; route handlers can write here.
        }
      },
    },
  });
}

export function createServiceClient() {
  if (!hasServerSupabaseConfig()) return null;
  const { url, secretKey } = getSupabaseConfig();
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
