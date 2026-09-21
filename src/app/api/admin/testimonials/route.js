import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/adminAuthorization";
import { createServiceClient } from "@/lib/supabase/server";
import { validateTestimonial } from "@/lib/validation";

export async function POST(request) { const auth = await authorizeAdminRequest(); if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status }); const validation = validateTestimonial(await request.json()); if (!validation.valid) return NextResponse.json({ message: validation.error }, { status: 422 }); const client = createServiceClient(); const { data, error } = await client.from("testimonials").insert(validation.data).select("*").single(); if (error) return NextResponse.json({ message: "The testimonial could not be added." }, { status: 500 }); return NextResponse.json({ ok: true, item: data }); }

