import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/adminAuthorization";
import { createServiceClient } from "@/lib/supabase/server";
import { cleanText } from "@/lib/validation";

export async function PUT(request) { const auth = await authorizeAdminRequest(); if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status }); const input = await request.json(); const values = { id: "primary", business_hours: cleanText(input.businessHours, 500) || null, after_hours_note: cleanText(input.afterHoursNote, 500) || null, emergency_service_available: Boolean(input.emergencyServiceAvailable), announcement: cleanText(input.announcement, 500) || null, announcement_enabled: Boolean(input.announcementEnabled) }; if (values.announcement_enabled && !values.announcement) return NextResponse.json({ message: "Enter an announcement before turning it on." }, { status: 422 }); const client = createServiceClient(); const { data, error } = await client.from("business_settings").upsert(values).select("*").single(); if (error) return NextResponse.json({ message: "Business settings could not be saved." }, { status: 500 }); return NextResponse.json({ ok: true, settings: data }); }

