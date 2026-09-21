import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

export async function POST(request) { const client = await createSessionClient(); if (client) await client.auth.signOut(); return NextResponse.redirect(new URL("/admin/login", request.url), 303); }

