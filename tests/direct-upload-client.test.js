import test from "node:test";
import assert from "node:assert/strict";
import { createDirectUploadDraft, DirectUploadError, submitDirectUpload, validateDirectUploadFiles } from "../src/lib/directUploadClient.js";

const supabaseUrl = "https://test-project.supabase.co";
const file = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "phone.jpg", { type: "image/jpeg" });
const galleryDraft = (files = [file()]) => createDirectUploadDraft({ kind: "gallery", files, metadata: { altText: "QA photo", published: false } });
const json = (data, status = 200) => Response.json(data, { status });
const sessionFor = (draft, overrides = {}) => ({
  sessionId: draft.requestId,
  token: draft.clientToken,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  uploads: draft.files.map((_, index) => ({ id: `file-${index}`, path: `qa/random-${index}.jpg`, token: "synthetic-test-token", signedUrl: `${supabaseUrl}/storage/v1/object/upload/sign/upload-staging/qa/random-${index}.jpg?token=synthetic-test-token` })),
  ...overrides,
});

test("direct uploader sends bytes only to Supabase and small JSON only to CutPro", async () => {
  const draft = galleryDraft([file(), file()]);
  const calls = [];
  const progress = [];
  let finalizing = 0;
  const result = await submitDirectUpload(draft, {
    supabaseUrl,
    onProgress: (message) => progress.push(message),
    onFinalizing: () => { finalizing += 1; },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url === "/api/admin/gallery/uploads") {
        const body = JSON.parse(options.body);
        assert.equal(body.requestId, draft.requestId);
        assert.equal(body.clientToken, draft.clientToken);
        assert.equal(body.files.length, 2);
        assert.deepEqual(Object.keys(body.files[0]).sort(), ["name", "size", "type"]);
        return json(sessionFor(draft));
      }
      return json(url === "/api/admin/gallery" ? { count: 2 } : { ok: true });
    },
  });
  assert.equal(result.count, 2);
  assert.equal(finalizing, 1);
  assert.equal(progress.length, 6);
  assert.equal(calls.length, 6);
  for (const { url, options } of calls) {
    if (url.startsWith(supabaseUrl)) {
      assert.equal(options.method, "PUT");
      assert.ok(options.body instanceof File);
      assert.equal(options.credentials, "omit");
      assert.equal(options.redirect, "error");
      assert.equal(options.referrerPolicy, "no-referrer");
      assert.deepEqual(options.headers, { "content-type": "image/jpeg", "x-upsert": "false" });
    } else {
      assert.equal(options.headers["content-type"], "application/json");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.cache, "no-store");
      assert.ok(new TextEncoder().encode(options.body).length < 64 * 1024);
      assert.equal(typeof options.body, "string");
    }
  }
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { sessionId: draft.requestId, token: draft.clientToken });
  assert.equal(await submitDirectUpload(draft, { fetchImpl: () => assert.fail("A completed draft must not submit again") }), result);
});

test("lost initialization response retries the same request ID and capability", async () => {
  const draft = galleryDraft();
  const bodies = [];
  let first = true;
  const fetchImpl = async (url, options) => {
    if (url.endsWith("/uploads")) {
      bodies.push(options.body);
      if (first) { first = false; throw new Error("Synthetic network failure with a URL that must not be shown"); }
      return json(sessionFor(draft));
    }
    return json(url === "/api/admin/gallery" ? { count: 1 } : { ok: true });
  };
  await assert.rejects(submitDirectUpload(draft, { fetchImpl, supabaseUrl }), (error) => error instanceof DirectUploadError && !error.message.includes("URL"));
  assert.equal(draft.session, null);
  await submitDirectUpload(draft, { fetchImpl, supabaseUrl });
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
});

test("lost storage response retries without overwrite and verifies duplicate object response", async () => {
  const draft = galleryDraft();
  let puts = 0;
  let verifies = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/uploads")) return json(sessionFor(draft));
    if (url.startsWith(supabaseUrl)) {
      puts += 1;
      if (puts === 1) throw new Error("Lost response after object was stored");
      return json({ statusCode: "409", error: "Duplicate", message: "The resource already exists" }, 400);
    }
    if (url.endsWith("/verify")) verifies += 1;
    return json(url === "/api/admin/gallery" ? { count: 1 } : { ok: true });
  };
  await assert.rejects(submitDirectUpload(draft, { fetchImpl, supabaseUrl }), DirectUploadError);
  await submitDirectUpload(draft, { fetchImpl, supabaseUrl });
  assert.equal(puts, 2);
  assert.equal(verifies, 1);
});

test("verification retry reuses the completed direct upload without creating another session", async () => {
  const draft = galleryDraft();
  let init = 0;
  let puts = 0;
  let verifies = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/uploads")) { init += 1; return json(sessionFor(draft)); }
    if (url.startsWith(supabaseUrl)) { puts += 1; return json({ ok: true }); }
    if (url.endsWith("/verify") && ++verifies === 1) return json({ message: "Photo verification is busy. Please retry." }, 409);
    return json(url === "/api/admin/gallery" ? { count: 1 } : { ok: true });
  };
  await assert.rejects(submitDirectUpload(draft, { fetchImpl, supabaseUrl }), (error) => error.status === 409);
  await submitDirectUpload(draft, { fetchImpl, supabaseUrl });
  assert.equal(init, 1);
  assert.equal(puts, 1);
  assert.equal(verifies, 2);
});

test("lost finalization response preserves the same lead/session and does not re-upload", async () => {
  const submissionToken = crypto.randomUUID();
  const draft = createDirectUploadDraft({ kind: "estimate", files: [file()], payload: { submissionToken, firstName: "QA" } });
  assert.equal(draft.requestId, submissionToken);
  let init = 0;
  let puts = 0;
  let verifies = 0;
  const finalBodies = [];
  const fetchImpl = async (url, options) => {
    if (url.endsWith("/uploads")) { init += 1; return json(sessionFor(draft)); }
    if (url.startsWith(supabaseUrl)) { puts += 1; return json({ ok: true }); }
    if (url.endsWith("/verify")) { verifies += 1; return json({ ok: true }); }
    finalBodies.push(options.body);
    if (finalBodies.length === 1) throw new Error("Lost response");
    return json({ reference: "CP-QA", duplicate: true });
  };
  await assert.rejects(submitDirectUpload(draft, { fetchImpl, supabaseUrl }), DirectUploadError);
  assert.equal(draft.finalizationAttempted, true);
  const result = await submitDirectUpload(draft, { fetchImpl, supabaseUrl });
  assert.equal(result.duplicate, true);
  assert.equal(init, 1);
  assert.equal(puts, 1);
  assert.equal(verifies, 1);
  assert.equal(finalBodies.length, 2);
  assert.equal(finalBodies[0], finalBodies[1]);
});

test("zero-photo estimates finalize using JSON without touching Storage", async () => {
  const draft = createDirectUploadDraft({ kind: "estimate", files: [], payload: { submissionToken: crypto.randomUUID() } });
  const calls = [];
  const result = await submitDirectUpload(draft, { fetchImpl: async (url, options) => {
    calls.push(url);
    assert.equal(typeof options.body, "string");
    return json(url.endsWith("/uploads") ? sessionFor(draft) : { reference: "CP-QA" });
  } });
  assert.deepEqual(calls, ["/api/estimate/uploads", "/api/estimate"]);
  assert.equal(result.reference, "CP-QA");
});

test("completed initialization replay returns the existing lead without using expired upload URLs", async () => {
  const draft = createDirectUploadDraft({ kind: "estimate", files: [file()], payload: { submissionToken: crypto.randomUUID() } });
  let calls = 0;
  const result = await submitDirectUpload(draft, { fetchImpl: async (url) => {
    calls += 1;
    assert.equal(url, "/api/estimate/uploads");
    return json({ sessionId: draft.requestId, token: draft.clientToken, completed: { ok: true, reference: "CP-EXISTING" } });
  } });
  assert.equal(calls, 1);
  assert.equal(result.reference, "CP-EXISTING");
  assert.equal(result.duplicate, true);
});

test("client rejects excessive count, invalid type, empty and oversized files before authorization", () => {
  assert.match(validateDirectUploadFiles(Array.from({ length: 7 }, file)), /no more than 6/);
  assert.equal(validateDirectUploadFiles(Array.from({ length: 6 }, file), { gallery: true }), null);
  assert.match(validateDirectUploadFiles([], { gallery: true }), /at least one/);
  assert.equal(validateDirectUploadFiles([]), null);
  assert.match(validateDirectUploadFiles([new File([], "empty.jpg", { type: "image/jpeg" })]), /empty/);
  assert.match(validateDirectUploadFiles([{ name: "huge.jpg", type: "image/jpeg", size: 8 * 1024 * 1024 + 1 }]), /8 MB/);
  assert.equal(validateDirectUploadFiles([{ name: "large.jpg", type: "image/jpeg", size: 8 * 1024 * 1024 }]), null);
  assert.match(validateDirectUploadFiles([{ name: "run.exe", type: "application/octet-stream", size: 1 }]), /images only/);
  assert.match(validateDirectUploadFiles([{ name: "phone.heic", type: "image/heic", size: 100 }], { gallery: true }), /JPG, PNG, or WebP/);
  assert.equal(validateDirectUploadFiles([{ name: "phone.heic", type: "image/heic", size: 100 }]), null);
});

test("untrusted upload destinations never receive file bytes or capability-bearing requests", async () => {
  for (const signedUrl of [
    "/api/admin/gallery",
    "https://other.example/storage/v1/object/upload/sign/path?token=synthetic",
    "http://test-project.supabase.co/storage/v1/object/upload/sign/path?token=synthetic",
    "https://test-project.supabase.co/api/estimate?token=synthetic",
    "https://user:password@test-project.supabase.co/storage/v1/object/upload/sign/path?token=synthetic",
  ]) {
    const draft = galleryDraft();
    const session = sessionFor(draft);
    session.uploads[0].signedUrl = signedUrl;
    let requests = 0;
    await assert.rejects(submitDirectUpload(draft, { supabaseUrl, fetchImpl: async (url) => {
      requests += 1;
      assert.equal(url, "/api/admin/gallery/uploads");
      return json(session);
    } }), DirectUploadError);
    assert.equal(requests, 1);
  }
});

test("an ordinary storage rejection never bypasses server validation or leaks storage diagnostics", async () => {
  const draft = galleryDraft();
  let requests = 0;
  await assert.rejects(submitDirectUpload(draft, { supabaseUrl, fetchImpl: async (url) => {
    requests += 1;
    if (url.endsWith("/uploads")) return json(sessionFor(draft));
    assert.ok(url.startsWith(supabaseUrl));
    return json({ message: "synthetic-sensitive-storage-diagnostic" }, 400);
  } }), (error) => error.status === 400 && !error.message.includes("sensitive"));
  assert.equal(requests, 2);
  assert.equal(draft.verified.size, 0);
  assert.equal(draft.finalizationAttempted, false);
});

test("oversized JSON is rejected before any app request", async () => {
  const draft = createDirectUploadDraft({ kind: "gallery", files: [file()], metadata: { altText: "x".repeat(64 * 1024) } });
  await assert.rejects(submitDirectUpload(draft, { fetchImpl: () => assert.fail("Oversized JSON must not be sent") }), /too long/);
});
