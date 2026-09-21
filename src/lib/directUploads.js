import { createHash, randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { MAX_PHOTO_COUNT, MAX_PHOTO_SIZE, cleanText, validateEstimate, validateGalleryMetadata, validatePhoto } from "./validation.js";
import { UploadValidationError, readValidatedPhoto, processPhotoInput } from "./uploadValidation.js";

export const MAX_UPLOAD_JSON = 64 * 1024;
export const DRAFT_LIFETIME_MS = 30 * 60 * 1000;
export const UPLOAD_CLEANUP_DELAY_MS = 130 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAPABILITY = /^[0-9a-f-]{72}$/i;
const PROCESSING_LEASE_MS = 10 * 60 * 1000;
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };

export class DirectUploadError extends Error {
  constructor(message, status = 422) { super(message); this.name = "DirectUploadError"; this.status = status; }
}

export function hashCapability(token) { return createHash("sha256").update(token).digest("hex"); }

// Enforce the actual streamed size, including chunked requests without Content-Length.
export async function readUploadJson(request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new DirectUploadError("Use the direct photo uploader; this endpoint accepts only JSON metadata.", 415);
  }
  if (Number(request.headers.get("content-length")) > MAX_UPLOAD_JSON) throw new DirectUploadError("Upload metadata is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DirectUploadError("Upload metadata is missing.", 400);
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UPLOAD_JSON) {
        await reader.cancel();
        throw new DirectUploadError("Upload metadata is too large.", 413);
      }
      chunks.push(Buffer.from(value));
    }
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid object");
    return input;
  } catch (error) {
    if (error instanceof DirectUploadError) throw error;
    throw new DirectUploadError("Upload metadata is invalid.", 400);
  } finally { reader.releaseLock(); }
}

export function safePhotoName(name) {
  return cleanText(String(name || "").replaceAll("\\", "/").split("/").pop(), 180);
}

export function validateManifest(files, purpose) {
  if (!Array.isArray(files) || files.length > MAX_PHOTO_COUNT || (purpose === "gallery" && !files.length)) {
    throw new DirectUploadError(purpose === "gallery" ? "Choose between one and six photos." : "Add no more than six photos.");
  }
  return files.map((file) => {
    if (!file || !Number.isSafeInteger(file.size) || file.size <= 0 || typeof file.type !== "string" || typeof file.name !== "string") {
      throw new DirectUploadError("The photo information is invalid.");
    }
    const descriptor = { name: safePhotoName(file.name), type: file.type, size: file.size };
    const error = validatePhoto(descriptor, { gallery: purpose === "gallery" });
    if (error) throw new DirectUploadError(error);
    const extension = descriptor.name.split(".").pop().toLowerCase();
    if (!(file.type === "image/jpeg" ? ["jpg", "jpeg"] : [extensions[file.type]]).includes(extension)) {
      throw new DirectUploadError("The photo extension must match its image type.");
    }
    return descriptor;
  });
}

function credentials(input) {
  if (!UUID.test(input.sessionId || input.requestId || "") || !CAPABILITY.test(input.token || input.clientToken || "")) {
    throw new DirectUploadError("The upload session could not be verified.", 403);
  }
  return { id: input.sessionId || input.requestId, hash: hashCapability(input.token || input.clientToken) };
}

function storageBuckets(purpose) {
  return { source: purpose === "gallery" ? "gallery-staging" : "lead-photos", destination: purpose === "gallery" ? "gallery-media" : "lead-photos" };
}

function databaseError() { return new DirectUploadError("Photo storage is not ready. Please try again later.", 503); }

export async function getUploadSession(client, input, purpose, ownerId) {
  const { id, hash } = credentials(input);
  const { data, error } = await client.from("upload_sessions").select("*").eq("id", id).eq("token_hash", hash).maybeSingle();
  if (error) throw databaseError();
  if (!data || data.purpose !== purpose || (purpose === "gallery" && data.owner_id !== ownerId)) {
    throw new DirectUploadError("The upload session could not be verified.", 403);
  }
  return data;
}

function assertOpen(session, { recover = false } = {}) {
  if (new Date(session.expires_at).getTime() <= Date.now()) throw new DirectUploadError("This upload session has expired. Start a new request.", 410);
  const staleWorker = recover && session.status === "processing" && session.locked_at && new Date(session.locked_at).getTime() < Date.now() - PROCESSING_LEASE_MS;
  if (session.status !== "open" && !staleWorker) throw new DirectUploadError("These photos are already being processed. Please retry shortly.", 409);
}

function sessionResponse(session, token) {
  return { sessionId: session.id, token, expiresAt: session.expires_at, uploads: session.files.map((file) => ({ id: file.id, ...file.authorization })) };
}

export async function beginUploadSession(client, { input, purpose, ownerId = null, budgetKey, verifyNewSubmission = async () => true }) {
  const { id, hash } = credentials(input);
  const manifest = validateManifest(input.files, purpose);
  const validation = purpose === "gallery" ? validateGalleryMetadata(input.metadata || {}) : validateEstimate(input.payload || {});
  if (!validation.valid) throw new DirectUploadError(validation.error || "Review the estimate details before uploading.");
  if (purpose === "estimate" && validation.data.submissionToken !== id) throw new DirectUploadError("Refresh the estimate form and try again.");
  const { data: existing, error: readError } = await client.from("upload_sessions").select("*").eq("id", id).maybeSingle();
  if (readError) throw databaseError();
  if (existing) {
    if (existing.token_hash !== hash || existing.purpose !== purpose || existing.owner_id !== ownerId) throw new DirectUploadError("The upload session could not be verified.", 403);
    if (existing.result) return { ...sessionResponse(existing, input.clientToken), completed: existing.result };
    const previousManifest = existing.files.map(({ name, type, size }) => ({ name, type, size }));
    if (JSON.stringify(manifest) !== JSON.stringify(previousManifest) || JSON.stringify(existing.payload) !== JSON.stringify(validation.data)) {
      // JSONB key order is not stable: compare canonical objects below instead.
      if (canonical(manifest) !== canonical(previousManifest) || canonical(existing.payload) !== canonical(validation.data)) {
        throw new DirectUploadError("The request changed. Start a fresh upload for the changed details.", 409);
      }
    }
    assertOpen(existing);
    if (existing.files.every((file) => file.authorization)) return sessionResponse(existing, input.clientToken);
    throw new DirectUploadError("Upload authorization was interrupted. Start a new request.", 409);
  }
  if (!(await verifyNewSubmission())) throw new DirectUploadError("Please complete the anti-spam check.", 400);
  const { data: allowed, error: budgetError } = await client.rpc("consume_upload_budget", { p_key: budgetKey, p_limit: purpose === "gallery" ? 30 : 5, p_window_seconds: 900 });
  if (budgetError) throw databaseError();
  if (!allowed) throw new DirectUploadError("Too many upload requests. Please wait 15 minutes before trying again.", 429);
  const lockToken = randomUUID();
  const now = Date.now();
  const files = manifest.map((descriptor) => {
    const fileId = randomUUID();
    return { ...descriptor, id: fileId, path: `staging/${id}/${fileId}.${extensions[descriptor.type]}`, outputPath: purpose === "gallery" ? `direct/${id}/${fileId}.webp` : `${id}/${fileId}.${extensions[descriptor.type]}`, state: "pending" };
  });
  const session = { id, purpose, owner_id: ownerId, token_hash: hash, payload: validation.data, files, status: "processing", lock_token: lockToken, locked_at: new Date(now).toISOString(), expires_at: new Date(now + DRAFT_LIFETIME_MS).toISOString(), cleanup_after: new Date(now + UPLOAD_CLEANUP_DELAY_MS).toISOString() };
  const { error: insertError } = await client.from("upload_sessions").insert(session);
  if (insertError?.code === "23505") throw new DirectUploadError("This upload request is already starting. Please retry shortly.", 409);
  if (insertError) throw databaseError();
  // The durable ledger exists BEFORE signing or writing any object. Never renew
  // these two-hour Storage grants on retry, and never permit overwrite/upsert.
  try {
    for (const file of files) {
      const { data, error } = await client.storage.from(storageBuckets(purpose).source).createSignedUploadUrl(file.path, { upsert: false });
      if (error || !data?.signedUrl || !data?.token) throw databaseError();
      file.authorization = { path: file.path, signedUrl: data.signedUrl, token: data.token };
    }
    const { data, error } = await client.from("upload_sessions").update({ files, status: "open", lock_token: null, locked_at: null }).eq("id", id).eq("lock_token", lockToken).select("*").single();
    if (error || !data) throw databaseError();
    return sessionResponse(data, input.clientToken);
  } catch (error) {
    await client.from("upload_sessions").update({ status: "open", lock_token: null, locked_at: null }).eq("id", id).eq("lock_token", lockToken);
    throw error;
  }
}

function canonical(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(canonical(item))));
  if (value && typeof value === "object") return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((key) => [key, JSON.parse(canonical(value[key]))])));
  return JSON.stringify(value);
}

async function claimSession(client, session) {
  assertOpen(session, { recover: true });
  const lockToken = randomUUID();
  let query = client.from("upload_sessions").update({ status: "processing", lock_token: lockToken, locked_at: new Date().toISOString() }).eq("id", session.id).eq("status", session.status).gt("expires_at", new Date().toISOString());
  if (session.status === "processing") query = query.eq("lock_token", session.lock_token).lt("locked_at", new Date(Date.now() - PROCESSING_LEASE_MS).toISOString());
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw databaseError();
  if (!data) throw new DirectUploadError("These photos are already being processed. Please retry shortly.", 409);
  return data;
}

async function releaseSession(client, session, files) {
  const update = { status: "open", lock_token: null, locked_at: null };
  if (files) update.files = files;
  const { data, error } = await client.from("upload_sessions").update(update).eq("id", session.id).eq("status", "processing").eq("lock_token", session.lock_token).select("id").maybeSingle();
  if (error || !data) throw databaseError();
}

export function validHeifContainer(buffer) {
  let offset = 0;
  let meta = false;
  let media = false;
  while (offset + 8 <= buffer.length) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > buffer.length) return false;
      const wide = buffer.readBigUInt64BE(offset + 8);
      if (wide > BigInt(buffer.length)) return false;
      size = Number(wide); header = 16;
    } else if (size === 0) size = buffer.length - offset;
    if (size < header || offset + size > buffer.length) return false;
    if (type === "meta" && size > header + 4) meta = true;
    if (type === "mdat" && size > header) media = true;
    offset += size;
  }
  return offset === buffer.length && meta && media;
}

export async function inspectStoredPhoto(buffer, descriptor, { gallery = false } = {}) {
  if (buffer.length !== descriptor.size || buffer.length > MAX_PHOTO_SIZE) throw new UploadValidationError("The uploaded photo size does not match its authorized size.");
  await readValidatedPhoto({ ...descriptor, arrayBuffer: async () => buffer }, { gallery });
  if (["image/heic", "image/heif"].includes(descriptor.type)) {
    if (!validHeifContainer(buffer)) throw new UploadValidationError("This HEIC/HEIF photo is incomplete or invalid.");
    return buffer;
  }
  const image = sharp(buffer, { limitInputPixels: 60_000_000, failOn: "error", animated: false }).timeout({ seconds: 12 });
  const metadata = await processPhotoInput(() => image.metadata());
  const expected = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[descriptor.type];
  if (metadata.format !== expected || !metadata.width || !metadata.height || (metadata.pages || 1) > 1) throw new UploadValidationError("Choose a supported, non-animated photograph.");
  if (gallery) return processPhotoInput(() => image.rotate().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer());
  // Force a decoder pass; a claimed MIME type or plausible header is insufficient.
  await processPhotoInput(() => image.resize(1, 1).raw().toBuffer());
  return buffer;
}

async function downloadBounded(client, bucket, file) {
  const storage = client.storage.from(bucket);
  const { data: info, error: infoError } = await storage.info(file.path);
  if (infoError || !info) throw new DirectUploadError("A photo has not finished uploading. Please retry.", 409);
  const size = Number(info.metadata?.size ?? info.size);
  if (!Number.isSafeInteger(size) || size !== file.size || size > MAX_PHOTO_SIZE) throw new UploadValidationError("The uploaded photo size does not match its authorized size.");
  // The source bucket independently enforces 8 MiB and disallows overwrite.
  // No signed download URL or image bytes are returned through an app route.
  const { data, error } = await storage.download(file.path);
  if (error || !data) throw new DirectUploadError("The stored photo could not be checked. Please retry.", 503);
  if (data.size > MAX_PHOTO_SIZE) throw new UploadValidationError("Each photo must be 8 MB or smaller.");
  return Buffer.from(await data.arrayBuffer());
}

export async function verifyUploadFile(client, { input, purpose, ownerId }) {
  const original = await getUploadSession(client, input, purpose, ownerId);
  if (!UUID.test(input.fileId || "")) throw new DirectUploadError("The photo reference is invalid.", 403);
  const originalFile = original.files.find((file) => file.id === input.fileId);
  if (!originalFile) throw new DirectUploadError("This photo does not belong to this submission.", 403);
  if (original.result || originalFile.state === "ready") return { ok: true };
  const session = await claimSession(client, original);
  const file = session.files.find((item) => item.id === input.fileId);
  const buckets = storageBuckets(purpose);
  try {
    const buffer = await downloadBounded(client, buckets.source, file);
    const processed = await inspectStoredPhoto(buffer, file, { gallery: purpose === "gallery" });
    // Destinations are immutable, even on recovery. A late worker must never
    // delete an object that another worker may already have attached to a lead.
    const storedType = purpose === "gallery" ? "image/webp" : file.type;
    const destination = client.storage.from(buckets.destination);
    const { error: uploadError } = purpose === "gallery"
      ? await destination.upload(file.outputPath, processed, { contentType: storedType, upsert: false, cacheControl: "31536000" })
      : typeof client.storage.from(buckets.source).copy === "function"
        ? await client.storage.from(buckets.source).copy(file.path, file.outputPath)
        : await destination.upload(file.outputPath, processed, { contentType: storedType, upsert: false, cacheControl: "0" });
    if (uploadError) {
      // A previous worker can commit Storage but lose its database response.
      // Only reuse byte-identical server-owned output; never overwrite it.
      if (!/already exists|duplicate|\bexists\b|409/i.test(String(uploadError.message || uploadError.statusCode || uploadError.status || ""))) throw databaseError();
      const retained = await downloadBounded(client, buckets.destination, { ...file, path: file.outputPath, size: processed.length });
      if (!createHash("sha256").update(retained).digest().equals(createHash("sha256").update(processed).digest())) throw databaseError();
    }
    if (purpose === "gallery") {
      const { data } = client.storage.from(buckets.destination).getPublicUrl(file.outputPath);
      file.reference = { storage_path: file.outputPath, public_url: data.publicUrl };
    } else {
      file.reference = { path: file.outputPath, originalName: file.name, originalType: file.type, originalSize: file.size, storedType, storedSize: processed.length };
    }
    file.state = "ready";
    await releaseSession(client, session, session.files);
    return { ok: true };
  } catch (error) {
    // Keep the original through signed-grant expiry: removing it early lets a
    // still-valid grant recreate the object. Cleanup owns eventual removal.
    await releaseSession(client, session);
    throw error;
  }
}

function estimateRecord(session) {
  const data = session.payload;
  return {
    id: session.id,
    reference: `CP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`,
    submission_token: session.id, source: "estimate", first_name: data.firstName, last_name: data.lastName || "", phone: data.phone,
    email: data.email || null, property_address: data.propertyAddress, city: data.city, zip: data.zip, services: data.services,
    urgency: data.urgency, job_description: data.jobDescription, approximate_count: data.approximateCount || null,
    preferred_timeframe: data.preferredTimeframe || null, preferred_contact_method: data.preferredContactMethod,
    best_contact_time: data.bestContactTime || null, customer_notes: data.customerNotes || null,
    photo_references: session.files.map((file) => file.reference),
  };
}

export async function finishUploadSession(client, { input, purpose, ownerId }) {
  const original = await getUploadSession(client, input, purpose, ownerId);
  if (original.result) return { ...original.result, duplicate: true };
  const session = await claimSession(client, original);
  try {
    if (session.files.some((file) => file.state !== "ready" || !file.reference)) throw new DirectUploadError("Wait until every photo has uploaded and passed validation.", 409);
    const lead = purpose === "estimate" ? estimateRecord(session) : null;
    const gallery = purpose === "gallery" ? session.files.map((file) => ({ ...session.payload, ...file.reference, alt_text: `${session.payload.alt_text}${session.files.length > 1 ? ` — ${file.name.replace(/\.[^.]+$/, "")}` : ""}`.slice(0, 180) })) : null;
    const { data, error } = await client.rpc("finalize_upload_session", { p_session_id: session.id, p_lock_token: session.lock_token, p_lead: lead, p_gallery: gallery });
    if (error || !data) throw databaseError();
    return data;
  } catch (error) {
    // If the database committed but its response was lost, do not undo it.
    const current = await getUploadSession(client, input, purpose, ownerId);
    if (current.result) return { ...current.result, duplicate: true };
    await releaseSession(client, session);
    throw error;
  }
}
