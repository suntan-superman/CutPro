import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/adminAuthorization";
import { createServiceClient } from "@/lib/supabase/server";
import { validateTestimonial } from "@/lib/validation";

export async function PATCH(request, { params }) { const auth = await authorizeAdminRequest(); if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status }); const { id } = await params; const validation = validateTestimonial(await request.json()); if (!validation.valid) return NextResponse.json({ message: validation.error }, { status: 422 }); const client = createServiceClient(); const { data, error } = await client.from("testimonials").update(validation.data).eq("id", id).is("archived_at", null).select("*").single(); if (error) return NextResponse.json({ message: "The testimonial could not be updated." }, { status: 500 }); return NextResponse.json({ ok: true, item: data }); }
export async function DELETE(_request, { params }) { const auth = await authorizeAdminRequest(); if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status }); const { id } = await params; const client = createServiceClient(); const { error } = await client.from("testimonials").update({ archived_at: new Date().toISOString(), published: false }).eq("id", id); if (error) return NextResponse.json({ message: "The testimonial could not be archived." }, { status: 500 }); return NextResponse.json({ ok: true }); }

