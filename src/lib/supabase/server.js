import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseConfig,
  hasPublicSupabaseConfig,
  hasServerSupabaseConfig,
} from "@/lib/supabase/config";

export async function createSessionClient() {
  if (!hasPublicSupabaseConfig()) return null;
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfig();

  return createServerClient(url, anonKey, {
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
          // Server components cannot always mutate cookies. Route handlers and
          // server actions refresh sessions when mutation is available.
        }
      },
    },
  });
}

export function createServiceClient() {
  if (!hasServerSupabaseConfig()) return null;
  const { url, serviceRoleKey } = getSupabaseConfig();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

