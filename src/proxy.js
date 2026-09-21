import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getSupabaseConfig, hasPublicSupabaseConfig } from "@/lib/supabase/config";
import { getSessionCookieOptions } from "@/lib/supabase/sessionCookies";

export async function proxy(request) {
  let response = NextResponse.next({ request });
  const pendingCookies = new Map();

  if (hasPublicSupabaseConfig()) {
    const { url, publishableKey } = getSupabaseConfig();
    const client = createServerClient(url, publishableKey, {
      cookieOptions: getSessionCookieOptions(request.headers),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
            pendingCookies.set(cookie.name, cookie);
          }
          // Forward refreshed cookies to this render and persist them in the browser.
          response = NextResponse.next({ request });
          for (const { name, value, options } of pendingCookies.values()) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // This refresh is not the authorization boundary. Every private DAL read and
    // mutation still verifies the user and current admin_users membership.
    await client.auth.getUser();
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
