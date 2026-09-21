import { NextResponse } from "next/server";
import { createServiceClient, createSessionClient } from "@/lib/supabase/server";
import { cleanText } from "@/lib/validation";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";

export async function POST(request) {
  const rate = checkRateLimit(`admin-login:${getRequestIp(request)}`, { limit: 8, windowMs: 15 * 60 * 1000 });
  if (!rate.allowed) return NextResponse.json({ message: "Too many sign-in attempts. Wait and try again." }, { status: 429 });
  const sessionClient = await createSessionClient(); const serviceClient = createServiceClient();
  if (!sessionClient || !serviceClient) return NextResponse.json({ message: "Admin sign-in is not configured yet." }, { status: 503 });
  try {
    const input = await request.json(); const email = cleanText(input.email, 160).toLowerCase(); const password = String(input.password || "");
    if (!email || !password) return NextResponse.json({ message: "Enter your email and password." }, { status: 422 });
    const { data, error } = await sessionClient.auth.signInWithPassword({ email, password });
    if (error || !data.user) return NextResponse.json({ message: "The email or password was not accepted." }, { status: 401 });
    const { data: profile } = await serviceClient.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (!profile) { await sessionClient.auth.signOut(); return NextResponse.json({ message: "This account is not authorized for the CutPro portal." }, { status: 403 }); }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ message: "Sign in could not be completed." }, { status: 500 }); }
}

