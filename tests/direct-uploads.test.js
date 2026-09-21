import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  beginUploadSession,
  DirectUploadError,
  DRAFT_LIFETIME_MS,
  finishUploadSession,
  getUploadSession,
  hashCapability,
  inspectStoredPhoto,
  MAX_UPLOAD_JSON,
  readUploadJson,
  safePhotoName,
  UPLOAD_CLEANUP_DELAY_MS,
  validateManifest,
  validHeifContainer,
  verifyUploadFile,
} from "../src/lib/directUploads.js";
import { UploadValidationError } from "../src/lib/uploadValidation.js";
import { MAX_PHOTO_COUNT, MAX_PHOTO_SIZE } from "../src/lib/validation.js";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherOwnerId = "22222222-2222-4222-8222-222222222222";
const clone = (value) => structuredClone(value);
const rejectsStatus = (promise, status) => assert.rejects(promise, (error) => error instanceof DirectUploadError && error.status === status);

function estimatePayload(id) {
  return {
    submissionToken: id, firstName: "Synthetic", lastName: "QA", phone: "6615550100",
    email: "unit-test@example.invalid", propertyAddress: "123 Unit Test Lane",
    city: "Bakersfield", zip: "93301", services: ["tree-trimming"], urgency: "Flexible",
    jobDescription: "Synthetic upload unit test, not a customer request.", preferredContactMethod: "Phone",
  };
}

function requestInput(files, purpose = "estimate") {
  const requestId = randomUUID();
  return {
    requestId, clientToken: randomBytes(36).toString("hex"), files,
    ...(purpose === "gallery" ? {
      metadata: { altText: "Synthetic tree photograph", category: "Tree Trimming", featured: true, published: true, sortOrder: 4, beforeAfterGroup: "unit-pair", beforeAfterRole: "before" },
    } : { payload: estimatePayload(requestId) }),
  };
}

const descriptor = (buffer, name = "phone.jpg", type = "image/jpeg") => ({ name, type, size: buffer.length });
const sessionInput = (response, extra = {}) => ({ sessionId: response.sessionId, token: response.token, ...extra });

// A deliberately small PostgREST/Storage double. Queries are evaluated only
// when awaited, and updates compare predicates atomically against stored rows.
// This tests application claims/ownership/retries; it does not certify SQL/RLS.
function memoryClient(options = {}) {
  const sessions = new Map();
  const objects = new Map();
  const leads = new Map();
  const gallery = [];
  const calls = [];
  let loseFinalizeResponse = Boolean(options.loseFinalizeResponse);
  let failDestinationUpload = Boolean(options.failDestinationUpload);
  const key = (bucket, path) => `${bucket}/${path}`;

  class Query {
    constructor(table) { this.table = table; this.filters = []; this.operation = "select"; this.value = null; }
    select() { return this; }
    eq(field, value) { this.filters.push((row) => row[field] === value); return this; }
    gt(field, value) { this.filters.push((row) => row[field] > value); return this; }
    lt(field, value) { this.filters.push((row) => row[field] < value); return this; }
    insert(value) { this.operation = "insert"; this.value = clone(value); return this; }
    update(value) { this.operation = "update"; this.value = clone(value); return this; }
    single() { return this.execute(true); }
    maybeSingle() { return this.execute(true); }
    then(resolve, reject) { return this.execute(false).then(resolve, reject); }
    async execute(single) {
      assert.equal(this.table, "upload_sessions");
      calls.push({ operation: this.operation, table: this.table });
      if (this.operation === "insert") {
        if (sessions.has(this.value.id)) return { data: null, error: { code: "23505" } };
        sessions.set(this.value.id, clone(this.value));
        return { data: null, error: null };
      }
      const matches = [...sessions.values()].filter((row) => this.filters.every((filter) => filter(row)));
      if (this.operation === "update") for (const row of matches) Object.assign(row, clone(this.value));
      return { data: clone(single ? matches[0] || null : matches), error: null };
    }
  }

  const client = {
    sessions, objects, leads, gallery, calls,
    from(table) { return new Query(table); },
    put(bucket, path, buffer, type) { objects.set(key(bucket, path), { buffer: Buffer.from(buffer), type }); },
    storage: {
      from(bucket) {
        return {
          async createSignedUploadUrl(path, opts) {
            calls.push({ operation: "sign", bucket, path, opts });
            assert.ok(sessions.size, "Persist the ownership ledger before signing anything");
            if (options.failSigning) return { data: null, error: { message: "synthetic storage error" } };
            return { data: { signedUrl: `https://storage.example.invalid/${bucket}/${path}?token=synthetic`, token: "synthetic" }, error: null };
          },
          async info(path) {
            calls.push({ operation: "info", bucket, path });
            const object = objects.get(key(bucket, path));
            return object ? { data: { metadata: { size: object.buffer.length } }, error: null } : { data: null, error: { message: "missing" } };
          },
          async download(path) {
            calls.push({ operation: "download", bucket, path });
            const object = objects.get(key(bucket, path));
            return object ? { data: new Blob([object.buffer], { type: object.type }), error: null } : { data: null, error: { message: "missing" } };
          },
          async remove(paths) {
            calls.push({ operation: "remove", bucket, paths });
            for (const path of paths) objects.delete(key(bucket, path));
            return { data: [], error: null };
          },
          async upload(path, buffer, opts) {
            calls.push({ operation: "upload", bucket, path, opts });
            if (failDestinationUpload) { failDestinationUpload = false; return { data: null, error: { message: "synthetic upload interruption" } }; }
            if (objects.has(key(bucket, path))) return { data: null, error: { message: "exists" } };
            objects.set(key(bucket, path), { buffer: Buffer.from(buffer), type: opts.contentType });
            return { data: { path }, error: null };
          },
          getPublicUrl(path) { return { data: { publicUrl: `https://storage.example.invalid/public/${bucket}/${path}` } }; },
        };
      },
    },
    async rpc(name, args) {
      calls.push({ operation: "rpc", name, args: clone(args) });
      if (name === "consume_upload_budget") return { data: options.allowBudget !== false, error: null };
      assert.equal(name, "finalize_upload_session");
      const row = sessions.get(args.p_session_id);
      if (!row || row.status !== "processing" || row.lock_token !== args.p_lock_token) return { data: null, error: { message: "claim rejected" } };
      if (args.p_lead) {
        assert.equal(leads.has(row.id), false, "Only one persistent lead per submission");
        leads.set(row.id, clone(args.p_lead));
        row.result = { ok: true, reference: args.p_lead.reference, duplicate: false };
      } else {
        const items = args.p_gallery.map((item) => ({ ...clone(item), id: randomUUID() }));
        gallery.push(...items);
        row.result = { ok: true, items, count: items.length, duplicate: false };
      }
      Object.assign(row, { status: "complete", lock_token: null, locked_at: null, completed_at: new Date().toISOString() });
      if (loseFinalizeResponse) { loseFinalizeResponse = false; return { data: null, error: { message: "response lost after commit" } }; }
      return { data: clone(row.result), error: null };
    },
  };
  return client;
}

let largePhoto;
function phonePhoto() {
  // Real decoded pixels, not an artificially padded small file. At ~7 MiB the
  // body exceeds Netlify's binary request ceiling and six exceed 32 MiB.
  largePhoto ??= sharp(randomBytes(4032 * 3024 * 3), { raw: { width: 4032, height: 3024, channels: 3 } })
    .withExif({ IFD0: { Artist: "PRIVATE SYNTHETIC QA METADATA" } }).jpeg({ quality: 75 }).toBuffer();
  return largePhoto;
}

async function smallPhoto() {
  return sharp({ create: { width: 24, height: 16, channels: 3, background: "#238437" } }).jpeg().toBuffer();
}

test("metadata endpoints accept a streamed JSON object at exactly 64 KiB", async () => {
  const body = JSON.stringify({ value: "x".repeat(MAX_UPLOAD_JSON - 12) });
  assert.equal(Buffer.byteLength(body), MAX_UPLOAD_JSON);
  const result = await readUploadJson(new Request("https://app.example.invalid/upload", { method: "POST", headers: { "content-type": "Application/JSON; charset=utf-8" }, body }));
  assert.equal(result.value.length, MAX_UPLOAD_JSON - 12);
});

test("streamed metadata limits count actual bytes without trusting Content-Length", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(MAX_UPLOAD_JSON)); controller.enqueue(new Uint8Array(1)); },
    cancel() { cancelled = true; },
  });
  const request = new Request("https://app.example.invalid/upload", { method: "POST", headers: { "content-type": "application/json", "content-length": "1" }, body: stream, duplex: "half" });
  await rejectsStatus(readUploadJson(request), 413);
  assert.equal(cancelled, true);
  assert.equal(stream.locked, false);
  const multibyte = JSON.stringify({ value: "€".repeat(MAX_UPLOAD_JSON / 2) });
  await rejectsStatus(readUploadJson(new Request("https://app.example.invalid/upload", { method: "POST", headers: { "content-type": "application/json" }, body: multibyte })), 413);
});

test("metadata endpoints reject multipart, missing bodies, invalid JSON and non-objects", async () => {
  await rejectsStatus(readUploadJson(new Request("https://app.example.invalid/upload", { method: "POST", body: new FormData() })), 415);
  await rejectsStatus(readUploadJson(new Request("https://app.example.invalid/upload", { method: "POST", headers: { "content-type": "application/json" } })), 400);
  for (const body of ["{broken", "null", "[]", "123", '"text"']) {
    await rejectsStatus(readUploadJson(new Request("https://app.example.invalid/upload", { method: "POST", headers: { "content-type": "application/json" }, body })), 400);
  }
  await rejectsStatus(readUploadJson(new Request("https://app.example.invalid/upload", { method: "POST", headers: { "content-type": "application/json", "content-length": String(MAX_UPLOAD_JSON + 1) }, body: "{}" })), 413);
});

test("six individually 8 MiB images remain accepted with no 32 MiB aggregate workaround", () => {
  const files = Array.from({ length: MAX_PHOTO_COUNT }, (_, i) => ({ name: `phone-${i}.jpg`, type: "image/jpeg", size: MAX_PHOTO_SIZE }));
  for (const purpose of ["gallery", "estimate"]) {
    const manifest = validateManifest(files, purpose);
    assert.equal(manifest.length, 6);
    assert.equal(manifest.reduce((sum, file) => sum + file.size, 0), 48 * 1024 * 1024);
  }
  assert.deepEqual(validateManifest([], "estimate"), []);
  assert.throws(() => validateManifest([], "gallery"), DirectUploadError);
});

test("manifests enforce count, integral positive sizes, matching types/extensions and safe names", () => {
  const valid = { name: "phone.jpg", type: "image/jpeg", size: 1024 };
  for (const files of [null, {}, Array(7).fill(valid), [null], [{ ...valid, size: 0 }], [{ ...valid, size: -1 }], [{ ...valid, size: 2.5 }], [{ ...valid, size: NaN }], [{ ...valid, size: Infinity }], [{ ...valid, size: MAX_PHOTO_SIZE + 1 }], [{ ...valid, type: "application/javascript" }], [{ ...valid, name: "photo.exe" }], [{ ...valid, name: "photo.png" }], [{ ...valid, name: "photo.jpg\u0000.exe" }], [{ ...valid, name: {} }]]) {
    assert.throws(() => validateManifest(files, "estimate"), DirectUploadError);
  }
  assert.equal(validateManifest([{ ...valid, name: "PHONE.JPEG" }], "gallery")[0].name, "PHONE.JPEG");
  assert.equal(validateManifest([{ name: "phone.heic", type: "image/heic", size: 128 }], "estimate").length, 1);
  assert.throws(() => validateManifest([{ name: "phone.heic", type: "image/heic", size: 128 }], "gallery"), DirectUploadError);
  assert.equal(safePhotoName("C:\\private\\..\\photo\u0000.jpg"), "photo.jpg");
  assert.equal(safePhotoName("../../private/photo.jpg"), "photo.jpg");
  assert.equal(safePhotoName("a".repeat(400)).length, 180);
});

test("large modern-phone gallery inputs are decoded, resized and stripped of source metadata", async () => {
  const source = await phonePhoto();
  assert.ok(source.length > 4.5 * 1024 * 1024);
  assert.ok(source.length <= MAX_PHOTO_SIZE);
  assert.ok((await sharp(source).metadata()).exif);
  const normalized = await inspectStoredPhoto(source, descriptor(source), { gallery: true });
  const metadata = await sharp(normalized).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 2200);
  assert.equal(metadata.height, 1650);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);
  assert.ok(normalized.length < source.length);
});

test("private estimate originals are decoded for validation without lossy re-encoding", async () => {
  const source = await phonePhoto();
  const validated = await inspectStoredPhoto(source, descriptor(source));
  assert.deepEqual(validated, source);
  assert.ok((await sharp(validated).metadata()).exif);
});

test("stored size, signatures, real decoder contents and pixel ceilings are enforced", async () => {
  const source = await smallPhoto();
  await assert.rejects(inspectStoredPhoto(source, { ...descriptor(source), size: source.length - 1 }), UploadValidationError);
  const oversize = Buffer.alloc(MAX_PHOTO_SIZE + 1);
  await assert.rejects(inspectStoredPhoto(oversize, descriptor(oversize)), UploadValidationError);
  for (const [buffer, name, type] of [
    [Buffer.from("not-a-photo"), "photo.jpg", "image/jpeg"],
    [Buffer.from([0xff, 0xd8, 0xff, 0x01]), "photo.jpg", "image/jpeg"],
    [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "photo.png", "image/png"],
    [Buffer.from("RIFF0000WEBP"), "photo.webp", "image/webp"],
  ]) {
    for (const gallery of [false, true]) await assert.rejects(inspectStoredPhoto(buffer, descriptor(buffer, name, type), { gallery }), UploadValidationError);
  }
  const hugeDimensions = Buffer.from(source);
  const marker = hugeDimensions.indexOf(Buffer.from([0xff, 0xc0]));
  assert.ok(marker > 0);
  hugeDimensions.writeUInt16BE(9000, marker + 5);
  hugeDimensions.writeUInt16BE(9000, marker + 7);
  await assert.rejects(inspectStoredPhoto(hugeDimensions, descriptor(hugeDimensions)), UploadValidationError);
});

test("private HEIF validation rejects a bare signature, invalid box sizes and truncation", async () => {
  const box = (type, contents) => { const header = Buffer.alloc(8); header.writeUInt32BE(contents.length + 8); header.write(type, 4); return Buffer.concat([header, contents]); };
  const ftyp = box("ftyp", Buffer.from("heic0000heic"));
  const container = Buffer.concat([ftyp, box("meta", Buffer.from([0, 0, 0, 0, 1])), box("mdat", Buffer.from([1, 2, 3]))]);
  assert.equal(validHeifContainer(container), true);
  for (const input of [ftyp, container.subarray(0, -1), Buffer.concat([container, Buffer.from([0])]), Buffer.from([0, 0, 0, 1, 109, 101, 116, 97])]) {
    assert.equal(validHeifContainer(input), false);
    await assert.rejects(inspectStoredPhoto(input, descriptor(input, "phone.heic", "image/heic")), UploadValidationError);
  }
});

test("begin persists a hashed capability and non-guessable narrowly scoped paths before signing", async () => {
  const client = memoryClient();
  const input = requestInput([{ name: "../../PRIVATE-name.jpg", type: "image/jpeg", size: MAX_PHOTO_SIZE }], "gallery");
  const before = Date.now();
  const response = await beginUploadSession(client, { input, purpose: "gallery", ownerId, budgetKey: "unit-admin" });
  const session = client.sessions.get(input.requestId);
  assert.equal(session.token_hash, hashCapability(input.clientToken));
  assert.equal(JSON.stringify(session).includes(input.clientToken), false);
  assert.equal(response.token, input.clientToken);
  assert.equal(session.status, "open");
  assert.equal(session.files[0].name, "PRIVATE-name.jpg");
  assert.match(session.files[0].path, new RegExp(`^staging/${input.requestId}/[0-9a-f-]{36}\\.jpg$`));
  assert.equal(session.files[0].path.includes("PRIVATE-name"), false);
  assert.match(session.files[0].outputPath, new RegExp(`^direct/${input.requestId}/[0-9a-f-]{36}\\.webp$`));
  assert.ok(new Date(session.expires_at).getTime() >= before + DRAFT_LIFETIME_MS);
  assert.ok(new Date(session.cleanup_after).getTime() >= before + UPLOAD_CLEANUP_DELAY_MS);
  const signature = client.calls.find((call) => call.operation === "sign");
  assert.equal(signature.bucket, "gallery-staging");
  assert.deepEqual(signature.opts, { upsert: false });
  assert.equal(client.calls.some((call) => call.operation === "upload"), false);
});

test("retries reuse grants without renewing their two-hour lifetime or consuming another budget", async () => {
  const client = memoryClient();
  const input = requestInput([{ name: "phone.jpg", type: "image/jpeg", size: 500 }]);
  let antiSpamCalls = 0;
  const args = { input, purpose: "estimate", budgetKey: "unit-ip", verifyNewSubmission: async () => { antiSpamCalls++; return true; } };
  const first = await beginUploadSession(client, args);
  const session = client.sessions.get(input.requestId);
  session.payload = Object.fromEntries(Object.entries(session.payload).reverse());
  const retry = await beginUploadSession(client, args);
  assert.deepEqual(retry, first);
  assert.equal(antiSpamCalls, 1);
  assert.equal(client.calls.filter((call) => call.operation === "sign").length, 1);
  assert.equal(client.calls.filter((call) => call.name === "consume_upload_budget").length, 1);
  await rejectsStatus(beginUploadSession(client, { ...args, input: { ...input, files: [{ ...input.files[0], size: 501 }] } }), 409);
  await rejectsStatus(beginUploadSession(client, { ...args, input: { ...input, payload: { ...input.payload, firstName: "Changed" } } }), 409);
});

test("denied anti-spam, durable budget and interrupted signing do not create usable grants", async () => {
  const input = requestInput([{ name: "phone.jpg", type: "image/jpeg", size: 500 }]);
  const denied = memoryClient();
  await rejectsStatus(beginUploadSession(denied, { input, purpose: "estimate", budgetKey: "unit-ip", verifyNewSubmission: async () => false }), 400);
  assert.equal(denied.sessions.size, 0);
  const limited = memoryClient({ allowBudget: false });
  await rejectsStatus(beginUploadSession(limited, { input, purpose: "estimate", budgetKey: "unit-ip" }), 429);
  assert.equal(limited.sessions.size, 0);
  assert.equal(limited.calls.some((call) => call.operation === "sign"), false);
  const interrupted = memoryClient({ failSigning: true });
  await rejectsStatus(beginUploadSession(interrupted, { input, purpose: "estimate", budgetKey: "unit-ip" }), 503);
  assert.equal(interrupted.sessions.size, 1, "The durable ledger remains available for eventual cleanup");
  assert.equal(interrupted.sessions.get(input.requestId).status, "open");
  await rejectsStatus(beginUploadSession(interrupted, { input, purpose: "estimate", budgetKey: "unit-ip" }), 409);
});

test("capability, purpose and admin ownership prevent cross-submission access before Storage calls", async () => {
  const client = memoryClient();
  const files = [{ name: "phone.jpg", type: "image/jpeg", size: 500 }];
  const first = await beginUploadSession(client, { input: requestInput(files), purpose: "estimate", budgetKey: "unit-ip" });
  const other = await beginUploadSession(client, { input: requestInput(files), purpose: "estimate", budgetKey: "unit-ip" });
  const admin = await beginUploadSession(client, { input: requestInput(files, "gallery"), purpose: "gallery", ownerId, budgetKey: "unit-admin" });
  const before = client.calls.length;
  await rejectsStatus(getUploadSession(client, { sessionId: first.sessionId, token: other.token }, "estimate"), 403);
  await rejectsStatus(getUploadSession(client, { sessionId: first.sessionId, token: "bad" }, "estimate"), 403);
  await rejectsStatus(getUploadSession(client, sessionInput(first), "gallery", ownerId), 403);
  await rejectsStatus(getUploadSession(client, sessionInput(admin), "gallery", otherOwnerId), 403);
  await rejectsStatus(getUploadSession(client, sessionInput(admin), "gallery"), 403);
  await rejectsStatus(verifyUploadFile(client, { input: sessionInput(first, { fileId: other.uploads[0].id }), purpose: "estimate" }), 403);
  assert.equal(client.calls.slice(before).some((call) => ["info", "download", "upload"].includes(call.operation)), false);
});

test("unuploaded, size-mismatched and spoofed objects cannot become persistent leads", async () => {
  const client = memoryClient();
  const source = await smallPhoto();
  const response = await beginUploadSession(client, { input: requestInput([descriptor(source)]), purpose: "estimate", budgetKey: "unit-ip" });
  const input = sessionInput(response, { fileId: response.uploads[0].id });
  await rejectsStatus(verifyUploadFile(client, { input, purpose: "estimate" }), 409);
  client.put("lead-photos", response.uploads[0].path, Buffer.alloc(source.length + 1), "image/jpeg");
  await assert.rejects(verifyUploadFile(client, { input, purpose: "estimate" }), UploadValidationError);
  assert.equal(client.calls.some((call) => call.operation === "download"), false, "Size mismatch is rejected before fetching bytes");
  client.put("lead-photos", response.uploads[0].path, Buffer.alloc(source.length), "image/jpeg");
  await assert.rejects(verifyUploadFile(client, { input, purpose: "estimate" }), UploadValidationError);
  await rejectsStatus(finishUploadSession(client, { input: sessionInput(response), purpose: "estimate" }), 409);
  assert.equal(client.sessions.get(response.sessionId).status, "open");
  assert.equal(client.leads.size, 0);
  assert.equal(client.calls.some((call) => call.operation === "upload"), false);
});

test("six actual large phone images finalize exactly one lead with only its verified private paths", async () => {
  const client = memoryClient();
  const source = await phonePhoto();
  const files = Array.from({ length: 6 }, (_, i) => descriptor(source, `phone-${i}.jpg`));
  assert.ok(files.reduce((sum, file) => sum + file.size, 0) > 32 * 1024 * 1024);
  const response = await beginUploadSession(client, { input: requestInput(files), purpose: "estimate", budgetKey: "unit-ip" });
  for (const upload of response.uploads) {
    client.put("lead-photos", upload.path, source, "image/jpeg");
    await verifyUploadFile(client, { input: sessionInput(response, { fileId: upload.id, path: "another-submission/stolen.jpg" }), purpose: "estimate" });
  }
  const result = await finishUploadSession(client, { input: sessionInput(response, { photoReferences: [{ path: "another-submission/stolen.jpg" }] }), purpose: "estimate" });
  assert.equal(result.ok, true);
  const repeated = await finishUploadSession(client, { input: sessionInput(response), purpose: "estimate" });
  assert.equal(repeated.reference, result.reference);
  assert.equal(repeated.duplicate, true);
  assert.equal(client.leads.size, 1);
  const lead = client.leads.get(response.sessionId);
  assert.equal(lead.photo_references.length, 6);
  for (const photo of lead.photo_references) {
    assert.match(photo.path, new RegExp(`^${response.sessionId}/[0-9a-f-]{36}\\.jpg$`));
    assert.equal(photo.storedType, "image/jpeg");
    assert.equal(photo.storedSize, source.length);
    assert.deepEqual(client.objects.get(`lead-photos/${photo.path}`).buffer, source);
  }
  assert.equal(client.calls.filter((call) => call.operation === "upload").every((call) => call.bucket === "lead-photos" && call.opts.upsert === false), true);
  assert.equal(response.uploads.every((upload) => client.objects.has(`lead-photos/${upload.path}`)), true, "Staged originals remain occupied until their signed grants expire");
  assert.equal(client.calls.filter((call) => call.name === "finalize_upload_session").length, 1);
});

test("gallery finalization preserves metadata while publishing only normalized WebP output", async () => {
  const client = memoryClient();
  const source = await smallPhoto();
  const input = requestInput([descriptor(source, "first.jpg"), descriptor(source, "second.jpg")], "gallery");
  const response = await beginUploadSession(client, { input, purpose: "gallery", ownerId, budgetKey: "unit-admin" });
  for (const upload of response.uploads) {
    client.put("gallery-staging", upload.path, source, "image/jpeg");
    await verifyUploadFile(client, { input: sessionInput(response, { fileId: upload.id }), purpose: "gallery", ownerId });
  }
  const result = await finishUploadSession(client, { input: sessionInput(response), purpose: "gallery", ownerId });
  assert.equal(result.count, 2);
  assert.equal(client.gallery.length, 2);
  for (const [index, item] of client.gallery.entries()) {
    assert.equal(item.published, true);
    assert.equal(item.featured, true);
    assert.equal(item.category, "Tree Trimming");
    assert.equal(item.sort_order, 4);
    assert.equal(item.before_after_group, "unit-pair");
    assert.equal(item.before_after_role, "before");
    assert.ok(item.alt_text.endsWith(index === 0 ? "first" : "second"));
    assert.ok(item.storage_path.endsWith(".webp"));
    assert.equal((await sharp(client.objects.get(`gallery-media/${item.storage_path}`).buffer).metadata()).format, "webp");
  }
  assert.equal(client.calls.filter((call) => call.operation === "upload").every((call) => call.bucket === "gallery-media" && call.opts.contentType === "image/webp"), true);
});

test("atomic claims admit only one concurrent verifier and ready-file retries do no extra work", async () => {
  const client = memoryClient();
  const source = await smallPhoto();
  const response = await beginUploadSession(client, { input: requestInput([descriptor(source)]), purpose: "estimate", budgetKey: "unit-ip" });
  client.put("lead-photos", response.uploads[0].path, source, "image/jpeg");
  const args = { input: sessionInput(response, { fileId: response.uploads[0].id }), purpose: "estimate" };
  const results = await Promise.allSettled([verifyUploadFile(client, args), verifyUploadFile(client, args)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(rejected.reason.status, 409);
  const storageOperations = client.calls.filter((call) => ["download", "upload", "remove"].includes(call.operation)).length;
  await verifyUploadFile(client, args);
  assert.equal(client.calls.filter((call) => ["download", "upload", "remove"].includes(call.operation)).length, storageOperations);
});

test("storage failures release claims and allow retries without removing grant-occupied originals", async () => {
  const client = memoryClient({ failDestinationUpload: true });
  const source = await smallPhoto();
  const response = await beginUploadSession(client, { input: requestInput([descriptor(source)]), purpose: "estimate", budgetKey: "unit-ip" });
  const upload = response.uploads[0];
  client.put("lead-photos", upload.path, source, "image/jpeg");
  const args = { input: sessionInput(response, { fileId: upload.id }), purpose: "estimate" };
  await rejectsStatus(verifyUploadFile(client, args), 503);
  assert.equal(client.sessions.get(response.sessionId).status, "open");
  assert.equal(client.objects.has(`lead-photos/${upload.path}`), true);
  assert.equal(client.sessions.get(response.sessionId).files[0].state, "pending");
  await verifyUploadFile(client, args);
  assert.equal(client.sessions.get(response.sessionId).files[0].state, "ready");
});

test("a lost successful finalization response is recovered without creating a second lead", async () => {
  const client = memoryClient({ loseFinalizeResponse: true });
  const response = await beginUploadSession(client, { input: requestInput([]), purpose: "estimate", budgetKey: "unit-ip" });
  const result = await finishUploadSession(client, { input: sessionInput(response), purpose: "estimate" });
  assert.equal(result.ok, true);
  assert.equal(result.duplicate, true);
  assert.equal(client.leads.size, 1);
  assert.equal(client.sessions.get(response.sessionId).status, "complete");
  const cached = await finishUploadSession(client, { input: sessionInput(response), purpose: "estimate" });
  assert.equal(cached.reference, result.reference);
  assert.equal(client.leads.size, 1);
});

test("expired sessions cannot verify new objects or finalize leads", async () => {
  const client = memoryClient();
  const source = await smallPhoto();
  const response = await beginUploadSession(client, { input: requestInput([descriptor(source)]), purpose: "estimate", budgetKey: "unit-ip" });
  client.sessions.get(response.sessionId).expires_at = new Date(Date.now() - 1).toISOString();
  await rejectsStatus(verifyUploadFile(client, { input: sessionInput(response, { fileId: response.uploads[0].id }), purpose: "estimate" }), 410);
  await rejectsStatus(finishUploadSession(client, { input: sessionInput(response), purpose: "estimate" }), 410);
  assert.equal(client.leads.size, 0);
});

test("an active worker cannot lose its claim, but a ten-minute stale claim can recover", async () => {
  const client = memoryClient();
  const source = await smallPhoto();
  const response = await beginUploadSession(client, { input: requestInput([descriptor(source)]), purpose: "estimate", budgetKey: "unit-ip" });
  const row = client.sessions.get(response.sessionId);
  const upload = response.uploads[0];
  client.put("lead-photos", upload.path, source, "image/jpeg");
  row.status = "processing";
  row.lock_token = randomUUID();
  row.locked_at = new Date(Date.now() - 9 * 60 * 1000).toISOString();
  const args = { input: sessionInput(response, { fileId: upload.id }), purpose: "estimate" };
  await rejectsStatus(verifyUploadFile(client, args), 409);
  assert.equal(client.calls.some((call) => call.operation === "download"), false);
  row.locked_at = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  // A late worker must never replace an attached destination. Simulate the
  // prior worker having committed the exact immutable copy already.
  client.put("lead-photos", row.files[0].outputPath, source, "image/jpeg");
  await verifyUploadFile(client, args);
  assert.equal(row.status, "open");
  assert.equal(row.lock_token, null);
  assert.equal(row.files[0].state, "ready");
  assert.deepEqual(client.objects.get(`lead-photos/${row.files[0].outputPath}`).buffer, source);
  assert.equal(client.objects.has(`lead-photos/${upload.path}`), true);
});

test("completed submission idempotency survives expiry and cleanup of sensitive draft fields", async () => {
  const client = memoryClient();
  const input = requestInput([]);
  const args = { input, purpose: "estimate", budgetKey: "unit-ip" };
  const response = await beginUploadSession(client, args);
  const completed = await finishUploadSession(client, { input: sessionInput(response), purpose: "estimate" });
  const row = client.sessions.get(response.sessionId);
  Object.assign(row, { status: "cleaned", expires_at: new Date(Date.now() - 1).toISOString(), payload: {}, files: [] });
  const beginAgain = await beginUploadSession(client, args);
  assert.equal(beginAgain.completed.reference, completed.reference);
  const finishAgain = await finishUploadSession(client, { input: sessionInput(response), purpose: "estimate" });
  assert.equal(finishAgain.reference, completed.reference);
  assert.equal(finishAgain.duplicate, true);
  assert.equal(client.leads.size, 1);
  assert.equal(client.calls.filter((call) => call.name === "consume_upload_budget").length, 1);
});
