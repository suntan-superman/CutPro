import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getSessionCookieOptions } from "@/lib/supabase/sessionCookies";
import { logoutSession } from "@/lib/supabase/logoutSession";

export async function POST(request) {
  const cookieStore = await cookies();
  const { url } = getSupabaseConfig();
  const cookieOptions = getSessionCookieOptions(request.headers);
  const { revocationFailed } = await logoutSession({
    createClient: createSessionClient,
    cookieStore,
    supabaseUrl: url,
    cookieOptions,
  });

  const response = revocationFailed
    ? new NextResponse(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signed out locally | CutPro</title></head><body><main><h1>Signed out of this browser</h1><p>Remote session revocation could not be confirmed. Other signed-in sessions may remain active.</p><p><a href="/admin/login">Return to sign in</a></p></main></body></html>',
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    )
    // Resolve against the browser's current origin, not Next's internal server
    // hostname (which may be localhost behind a reverse proxy).
    : new NextResponse(null, { status: 303, headers: { Location: "/admin/login" } });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
