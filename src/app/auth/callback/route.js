import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/admin/login?invite=invalid", url));
  const client = await createSessionClient();
  if (!client) return NextResponse.redirect(new URL("/admin/login?setup=required", url));
  const { error } = await client.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? "/admin/login?invite=invalid" : "/admin", url));
}
