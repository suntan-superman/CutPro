import { MAX_PHOTO_COUNT, validatePhoto } from "./validation.js";

const MAX_JSON_BYTES = 64 * 1024;
const RETRY_MESSAGE = "The connection was interrupted. Please retry; completed photo uploads will be reused.";

export class DirectUploadError extends Error {
  constructor(message, { status, errors } = {}) {
    super(message);
    this.name = "DirectUploadError";
    this.status = status;
    this.errors = errors;
  }
}

export function validateDirectUploadFiles(files, { gallery = false } = {}) {
  if (!Array.isArray(files) || files.length > MAX_PHOTO_COUNT) return `Choose no more than ${MAX_PHOTO_COUNT} photos.`;
  if (gallery && !files.length) return "Choose at least one photo.";
  for (const file of files) {
    if (!Number.isSafeInteger(file?.size) || file.size < 1) return "The photo is empty.";
    const error = validatePhoto(file, { gallery });
    if (error) return gallery && !["image/jpeg", "image/png", "image/webp"].includes(file.type) ? "Use JPG, PNG, or WebP images only." : error;
  }
  return null;
}

// This draft lives only in React memory: never persist upload capabilities in
// localStorage, analytics, query strings on CutPro pages, or browser logs.
export function createDirectUploadDraft({ kind, files, metadata, payload }) {
  if (!["gallery", "estimate"].includes(kind)) throw new DirectUploadError("This upload could not be started.");
  const error = validateDirectUploadFiles(files, { gallery: kind === "gallery" });
  if (error) throw new DirectUploadError(error);
  if (!globalThis.crypto?.randomUUID) throw new DirectUploadError("Please use a current browser over a secure connection to upload photos.");
  const requestId = kind === "estimate" ? payload?.submissionToken : crypto.randomUUID();
  const clientToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const details = files.map(({ name, type, size }) => ({ name, type, size }));
  return {
    kind,
    files: [...files],
    requestId,
    clientToken,
    initBody: { requestId, clientToken, files: details, ...(kind === "gallery" ? { metadata: { ...metadata } } : { payload: { ...payload } }) },
    session: null,
    uploaded: new Set(),
    verified: new Set(),
    finalizationAttempted: false,
    result: null,
  };
}

async function postJson(url, data, fetchImpl) {
  const body = JSON.stringify(data);
  if (new TextEncoder().encode(body).byteLength > MAX_JSON_BYTES) throw new DirectUploadError("The request details are too long. Please shorten them and try again.");
  let response;
  try {
    response = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body });
  } catch {
    throw new DirectUploadError(RETRY_MESSAGE);
  }
  let result;
  try { result = await response.json(); } catch { throw new DirectUploadError("The server could not finish this request. Please retry.", { status: response.status }); }
  if (!response.ok) throw new DirectUploadError(typeof result?.message === "string" ? result.message : "The request could not be completed. Please retry.", { status: response.status, errors: result?.errors });
  return result;
}

function storageUploadUrl(value, supabaseUrl) {
  try {
    const target = new URL(value);
    const configured = new URL(supabaseUrl);
    const directStorageHost = configured.hostname.endsWith(".supabase.co") ? configured.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co") : null;
    const trustedOrigin = target.origin === configured.origin || (target.protocol === "https:" && target.hostname === directStorageHost && !target.port);
    if (!trustedOrigin || target.protocol !== "https:" || target.username || target.password || !target.pathname.startsWith("/storage/v1/object/upload/sign/") || !target.searchParams.get("token")) throw new Error();
    return target.toString();
  } catch {
    throw new DirectUploadError("Secure photo upload is unavailable. Please try again later.");
  }
}

async function uploadFile(upload, file, { fetchImpl, supabaseUrl }) {
  const url = storageUploadUrl(upload.signedUrl, supabaseUrl);
  let response;
  try {
    // Raw PUT is supported by Supabase's signed-upload endpoint. The file bytes
    // never pass through a CutPro/Netlify route, and no CutPro cookie is sent.
    response = await fetchImpl(url, { method: "PUT", headers: { "content-type": file.type, "x-upsert": "false" }, credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", cache: "no-store", body: file });
  } catch {
    throw new DirectUploadError(RETRY_MESSAGE);
  }
  if (response.ok) return;
  // A response can be lost after Storage commits a file. On a retry, a duplicate
  // response is safe only because the server still verifies this exact slot.
  if ([400, 409].includes(response.status)) {
    const result = await response.json().catch(() => null);
    if (String(result?.statusCode) === "409" || result?.error === "Duplicate" || /already exists/i.test(String(result?.message || ""))) return;
  }
  throw new DirectUploadError(response.status === 413 ? "Each photo must be 8 MB or smaller." : "A photo could not be uploaded. Please retry; completed uploads will be reused.", { status: response.status });
}

export async function submitDirectUpload(draft, { onProgress = () => {}, onFinalizing = () => {}, fetchImpl = globalThis.fetch, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL } = {}) {
  if (draft.result) return draft.result;
  const base = draft.kind === "gallery" ? "/api/admin/gallery" : "/api/estimate";
  if (!draft.session) {
    onProgress("Preparing secure photo upload…");
    const session = await postJson(`${base}/uploads`, draft.initBody, fetchImpl);
    if (!session || session.sessionId !== draft.requestId || session.token !== draft.clientToken) throw new DirectUploadError("The secure upload could not be prepared. Please retry.");
    if (session.completed) {
      draft.result = { ...session.completed, duplicate: true };
      return draft.result;
    }
    if (!Array.isArray(session.uploads) || session.uploads.length !== draft.files.length || !session.uploads.every((upload) => typeof upload.id === "string" && upload.id) || new Set(session.uploads.map((upload) => upload.id)).size !== draft.files.length) throw new DirectUploadError("The secure upload could not be prepared. Please retry.");
    draft.session = session;
  }
  const { sessionId, token, uploads } = draft.session;
  for (let index = 0; index < draft.files.length; index += 1) {
    const upload = uploads[index];
    if (!draft.uploaded.has(upload.id)) {
      onProgress(`Uploading photo ${index + 1} of ${draft.files.length} directly…`);
      await uploadFile(upload, draft.files[index], { fetchImpl, supabaseUrl });
      draft.uploaded.add(upload.id);
    }
    if (!draft.verified.has(upload.id)) {
      onProgress(`Checking photo ${index + 1} of ${draft.files.length}…`);
      await postJson(`${base}/uploads/verify`, { sessionId, token, fileId: upload.id }, fetchImpl);
      draft.verified.add(upload.id);
    }
  }
  onProgress(draft.kind === "gallery" ? "Saving gallery photos…" : "Saving your request…");
  draft.finalizationAttempted = true;
  onFinalizing();
  draft.result = await postJson(base, { sessionId, token }, fetchImpl);
  return draft.result;
}
