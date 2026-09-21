import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/adminAuthorization";
import { createServiceClient } from "@/lib/supabase/server";
import { uploadGalleryPhoto } from "@/lib/uploads";
import { validateGalleryMetadata, validatePhoto } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  const auth = await authorizeAdminRequest(); if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });
  try { const form = await request.formData(); const files = form.getAll("photos").filter((file) => file instanceof File && file.size); if (!files.length || files.length > 6) return NextResponse.json({ message: "Choose between one and six photos." }, { status: 422 }); for (const file of files) { const error = validatePhoto(file, { gallery: true }); if (error) return NextResponse.json({ message: error }, { status: 422 }); }
    const validation = validateGalleryMetadata({ altText: form.get("altText"), caption: form.get("caption"), category: form.get("category"), serviceSlug: form.get("serviceSlug"), featured: form.get("featured") === "true", published: form.get("published") === "true", sortOrder: 0 }); if (!validation.valid) return NextResponse.json({ message: validation.error }, { status: 422 });
    const client = createServiceClient(); const created = [];
    for (const file of files) { const uploaded = await uploadGalleryPhoto(file); const suffix = files.length > 1 ? ` — ${file.name.replace(/\.[^.]+$/, "")}` : ""; const { data, error } = await client.from("gallery_items").insert({ ...validation.data, alt_text: `${validation.data.alt_text}${suffix}`.slice(0, 180), storage_path: uploaded.storagePath, public_url: uploaded.publicUrl }).select("*").single(); if (error) { await client.storage.from("gallery-media").remove([uploaded.storagePath]); throw error; } created.push(data); }
    return NextResponse.json({ ok: true, count: created.length, items: created });
  } catch (error) { console.error("Admin gallery upload failed", error); return NextResponse.json({ message: "The photos could not be added." }, { status: 500 }); }
}

