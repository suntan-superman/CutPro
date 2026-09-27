const UUID_PART = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const UUID = new RegExp(`^${UUID_PART}$`, "i");
const PRIVATE_LEAD_PHOTO_PATH = new RegExp(`^${UUID_PART}/${UUID_PART}\\.(?:jpg|jpeg|png|webp|heic|heif)$`, "i");
const STAGED_LEAD_PHOTO_PATH = new RegExp(`^staging/${UUID_PART}/${UUID_PART}\\.(?:jpg|jpeg|png|webp|heic|heif)$`, "i");

export function getLeadPhotoPaths(photoReferences) {
  if (!Array.isArray(photoReferences)) return { valid: false, paths: [] };
  const paths = [];
  for (const reference of photoReferences) {
    if (!reference || typeof reference !== "object" || typeof reference.path !== "string" || !PRIVATE_LEAD_PHOTO_PATH.test(reference.path)) {
      return { valid: false, paths: [] };
    }
    paths.push(reference.path);
  }
  return { valid: true, paths: [...new Set(paths)] };
}

export function getLeadUploadPaths(files) {
  if (!Array.isArray(files) || files.length > 6) return { valid: false, paths: [] };
  const paths = [];
  for (const file of files) {
    if (!file || typeof file !== "object" || typeof file.path !== "string" || typeof file.outputPath !== "string"
      || !STAGED_LEAD_PHOTO_PATH.test(file.path) || !PRIVATE_LEAD_PHOTO_PATH.test(file.outputPath)) {
      return { valid: false, paths: [] };
    }
    paths.push(file.path, file.outputPath);
  }
  return { valid: true, paths: [...new Set(paths)] };
}

export async function deleteLeadRecord(client, id) {
  if (!UUID.test(String(id || ""))) return { ok: false, status: 400, message: "The request reference is invalid." };

  const { data: lead, error: readError } = await client
    .from("leads")
    .select("id, photo_references")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, status: 500, message: "The request could not be loaded for deletion." };
  if (!lead) return { ok: false, status: 404, message: "This request no longer exists." };

  const photoPaths = getLeadPhotoPaths(lead.photo_references);
  if (!photoPaths.valid) return { ok: false, status: 500, message: "The request's stored photos could not be safely removed." };
  let paths = photoPaths.paths;
  if (paths.length) {
    const { data: session, error: sessionError } = await client
      .from("upload_sessions")
      .select("files")
      .eq("id", id)
      .maybeSingle();
    if (sessionError) return { ok: false, status: 500, message: "The request's private photo ledger could not be read. The request was not deleted." };
    if (session) {
      const uploadPaths = getLeadUploadPaths(session.files);
      if (!uploadPaths.valid) return { ok: false, status: 500, message: "The request's private photos could not be safely removed." };
      paths = [...new Set([...paths, ...uploadPaths.paths])];
    }
  }
  if (paths.length) {
    const { error: storageError } = await client.storage.from("lead-photos").remove(paths);
    if (storageError) return { ok: false, status: 500, message: "The request's private photos could not be removed. The request was not deleted." };
  }

  const { error: deleteError } = await client.from("leads").delete().eq("id", id);
  if (deleteError) return { ok: false, status: 500, message: "The request could not be deleted. Please retry." };
  return { ok: true, status: 200 };
}

export function adminLeadDeleteHandlers({ authorize, createClient }) {
  return {
    async DELETE(_request, { params }) {
      const auth = await authorize();
      if (!auth.ok) return Response.json({ message: auth.message }, { status: auth.status, headers: { "Cache-Control": "private, no-store" } });
      const { id } = await params;
      const client = createClient();
      if (!client) return Response.json({ message: "Lead storage is not configured." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
      try {
        const result = await deleteLeadRecord(client, id);
        return Response.json(result.ok ? { ok: true } : { message: result.message }, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
      } catch {
        return Response.json({ message: "The request could not be deleted. Please retry." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
      }
    },
  };
}
