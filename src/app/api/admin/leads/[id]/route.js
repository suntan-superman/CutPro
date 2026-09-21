import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/adminAuthorization";
import { createServiceClient } from "@/lib/supabase/server";
import { validateLeadUpdate } from "@/lib/validation";

export async function PATCH(request, { params }) { const auth = await authorizeAdminRequest(); if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status }); const { id } = await params; const validation = validateLeadUpdate(await request.json()); if (!validation.valid) return NextResponse.json({ message: validation.error }, { status: 422 }); const client = createServiceClient(); const { data, error } = await client.from("leads").update(validation.data).eq("id", id).select("id, status, internal_notes, updated_at").single(); if (error) return NextResponse.json({ message: "The lead could not be updated." }, { status: 500 }); return NextResponse.json({ ok: true, lead: data }); }

