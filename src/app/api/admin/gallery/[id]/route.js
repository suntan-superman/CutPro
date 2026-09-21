import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/adminAuthorization";
import { createServiceClient } from "@/lib/supabase/server";
import { validateGalleryMetadata } from "@/lib/validation";

export async function PATCH(request, { params }) {
  const auth = await authorizeAdminRequest();
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });
  const { id } = await params;
  const validation = validateGalleryMetadata(await request.json());
  if (!validation.valid) return NextResponse.json({ message: validation.error }, { status: 422 });
  const client = createServiceClient();
  const { data, error } = await client
    .from("gallery_items")
    .update(validation.data)
    .eq("id", id)
    .is("archived_at", null)
    .select("*")
    .single();
  if (error) return NextResponse.json({ message: "The gallery item could not be updated." }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(_request, { params }) {
  const auth = await authorizeAdminRequest();
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });
  const { id } = await params;
  const client = createServiceClient();
  const { data: item } = await client
    .from("gallery_items")
    .select("storage_path, published")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (!item) return NextResponse.json({ message: "Photo not found." }, { status: 404 });

  // Hide the item before removing the object. If storage removal fails,
  // restore its prior visibility so the metadata and media stay consistent.
  const { error: archiveError } = await client
    .from("gallery_items")
    .update({ archived_at: new Date().toISOString(), published: false })
    .eq("id", id)
    .is("archived_at", null);
  if (archiveError) {
    return NextResponse.json({ message: "The gallery record could not be archived." }, { status: 500 });
  }
  const { error: storageError } = await client.storage.from("gallery-media").remove([item.storage_path]);
  if (storageError) {
    const { error: rollbackError } = await client
      .from("gallery_items")
      .update({ archived_at: null, published: item.published })
      .eq("id", id);
    if (rollbackError) console.error("Gallery delete rollback failed", rollbackError);
    return NextResponse.json({ message: "The stored photo could not be removed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
