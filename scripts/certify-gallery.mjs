import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import sharp from "sharp";
import { makePhonePhoto, observeDirectUploadTraffic } from "./direct-upload-qa.mjs";

// Opt-in real-data certification. Writes occur only through the signed-in Admin
// UI and are limited to this run's synthetic QA gallery records. No credentials,
// cookies, signed URLs, owner details, network bodies, or screenshots are logged.
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const origin = process.env.CUTPRO_QA_ORIGIN || "http://127.0.0.1:3000";
const cdp = process.env.CUTPRO_QA_CDP || "http://127.0.0.1:9235";
const runArgument = process.argv.find((argument) => argument.startsWith("--run="))?.slice(6);
if (runArgument && !/^[0-9a-f]{8}$/.test(runArgument)) throw new Error("Invalid QA run ID");
const run = runArgument || randomUUID().slice(0, 8);
const cleanupOnly = process.argv.includes("--cleanup-only");
const prefix = `CUTPRO QA GALLERY ${run}`;
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const created = [];
const passed = [];
const pages = [];
let stage = "connect signed-in browser";
let unexpectedConsoleErrors = 0;
let expectedConsoleErrors = 0;
let pageErrors = 0;
let expectingRejection = false;
let failed = false;
let admin;
let publicPage;
let isolatedContext;
let traffic;

function pass(label) { passed.push(label); console.log(`PASS: ${label}`); }
async function readRecords() {
  const { data, error } = await client.from("gallery_items").select("*").like("alt_text", `${prefix}%`);
  assert.equal(error, null, "QA gallery read failed");
  return data;
}
async function objectExists(path, bucket = "gallery-media") {
  const { data, error } = await client.storage.from(bucket).info(path);
  if (data && !error) return true;
  assert([400, 404].includes(Number(error?.status)), "Unexpected storage lookup failure");
  return false;
}
async function uploadSessions() {
  const { data, error } = await client.from("upload_sessions").select("id,files,status,expires_at,cleanup_after,result").eq("purpose", "gallery").like("payload->>alt_text", `${prefix}%`);
  assert.equal(error, null, "QA upload-session read failed");
  return data;
}
function card(record) { return admin.locator(".admin-media-card").filter({ has: admin.locator(`[id="gallery-${record.id}-altText"]`) }); }
async function waitPreview(count) {
  const previews = admin.locator(".admin-upload-previews img");
  await previews.nth(count - 1).waitFor();
  assert.equal(await previews.count(), count);
  await admin.waitForFunction((expected) => {
    const images = [...document.querySelectorAll(".admin-upload-previews img")];
    return images.length === expected && images.every((image) => image.complete && image.naturalWidth > 0);
  }, count);
}
async function upload(files, suffix, { published = false, featured = false, expected = 200, preview = true } = {}) {
  await admin.locator("#galleryFiles").setInputFiles(files);
  if (preview) await waitPreview(files.length);
  await admin.locator("#newAlt").fill(`${prefix} ${suffix}`);
  await admin.locator("#newCaption").fill(`${prefix} ${suffix} — synthetic certification image, not customer work`);
  await admin.locator("#newCategory").selectOption("Tree Trimming");
  await admin.locator("#newService").selectOption("tree-trimming");
  const form = admin.locator("form.admin-form");
  await form.getByLabel("Feature on homepage").setChecked(featured);
  await form.getByLabel("Publish now").setChecked(published);
  const responsePath = expected === 200 ? "/api/admin/gallery" : "/api/admin/gallery/uploads/verify";
  const responsePromise = admin.waitForResponse((response) => response.url() === `${origin}${responsePath}` && response.request().method() === "POST" && response.status() === expected, { timeout: 180000 });
  await admin.getByRole("button", { name: "Upload photos", exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), expected, "Gallery upload status mismatch");
  const body = await response.json();
  if (response.ok()) {
    assert.equal(body.count, files.length);
    created.push(...body.items);
    for (const record of body.items) await card(record).waitFor();
    assert.equal(await admin.locator(".admin-upload-previews img").count(), 0);
  } else {
    await admin.getByText(body.message, { exact: true }).waitFor();
  }
  return body.items || [];
}
async function save(record, fields) {
  const item = card(record);
  for (const [name, value] of Object.entries(fields)) {
    if (["featured", "published"].includes(name)) {
      await item.getByLabel(name === "featured" ? "Featured" : "Published", { exact: true }).setChecked(value);
    } else {
      const field = admin.locator(`[id="gallery-${record.id}-${name}"]`);
      if (["category", "serviceSlug", "beforeAfterRole"].includes(name)) await field.selectOption(value);
      else await field.fill(String(value));
    }
  }
  const responsePromise = admin.waitForResponse((response) => response.url() === `${origin}/api/admin/gallery/${record.id}` && response.request().method() === "PATCH");
  await item.getByRole("button", { name: /^(Save|Saved)$/ }).click();
  assert.equal((await responsePromise).status(), 200);
  await item.getByRole("button", { name: "Saved", exact: true }).waitFor();
}
async function publicImages(path) {
  await publicPage.goto(`${origin}${path}`, { waitUntil: "networkidle" });
  return publicPage.locator("img").evaluateAll((items) => items.map((item) => item.alt));
}
async function remove(record, cancel = false) {
  const item = card(record);
  await item.waitFor();
  const dialogHandled = new Promise((resolve) => admin.once("dialog", async (dialog) => {
    try {
      assert.equal(dialog.type(), "confirm");
      assert(dialog.message().includes("Remove this photo"));
      if (cancel) await dialog.dismiss(); else await dialog.accept();
      resolve(true);
    } catch { resolve(false); }
  }));
  if (cancel) {
    await item.getByRole("button", { name: "Delete", exact: true }).click();
    assert.equal(await dialogHandled, true, "Native confirmation cancellation failed");
    assert.equal(await item.count(), 1);
    return;
  }
  const responsePromise = admin.waitForResponse((response) => response.url() === `${origin}/api/admin/gallery/${record.id}` && response.request().method() === "DELETE");
  await item.getByRole("button", { name: "Delete", exact: true }).click();
  assert.equal(await dialogHandled, true, "Native confirmation acceptance failed");
  assert.equal((await responsePromise).status(), 200);
  await item.waitFor({ state: "detached" });
}

try {
  const browser = await chromium.connectOverCDP(cdp);
  const ownerContext = browser.contexts()[0];
  assert(ownerContext, "Certification browser context missing");
  // A separate browser process avoids other CDP clients auto-dismissing dialogs.
  isolatedContext = await chromium.launchPersistentContext(fileURLToPath(new URL(`../artifacts/gallery-browser-${run}/`, import.meta.url)), { channel: "chrome", headless: true });
  await isolatedContext.addCookies(await ownerContext.cookies(origin));
  admin = await isolatedContext.newPage();
  traffic = observeDirectUploadTraffic(admin, { origin, projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, base: "/api/admin/gallery" });
  publicPage = await isolatedContext.newPage();
  pages.push(admin, publicPage);
  for (const page of pages) {
    page.setDefaultTimeout(30000);
    page.on("pageerror", () => { pageErrors += 1; });
    page.on("console", (message) => {
      if (message.type() === "error") {
        if (expectingRejection) expectedConsoleErrors += 1;
        else unexpectedConsoleErrors += 1;
      }
    });
  }
  await admin.goto(`${origin}/admin/gallery`, { waitUntil: "networkidle" });
  assert.equal(new URL(admin.url()).pathname, "/admin/gallery");
  if (!cleanupOnly) {
  pass("signed-in Gallery Manager loads");

  stage = "single image upload and private draft listing";
  const jpeg = await makePhonePhoto({ name: `${run}-before.jpg`, marker: prefix, seed: 7 });
  assert((await sharp(jpeg.buffer).metadata()).exif);
  assert(jpeg.buffer.length > 4.5 * 1024 * 1024 && jpeg.buffer.length <= 8 * 1024 * 1024);
  const pngBuffer = await sharp({ create: { width: 960, height: 640, channels: 3, background: "#31564e" } }).png().toBuffer();
  const png = { name: `${run}-after.png`, mimeType: "image/png", buffer: pngBuffer };
  const [single] = await upload([jpeg], "single");
  const singleDb = (await readRecords()).find((item) => item.id === single.id);
  assert.equal(singleDb.published, false);
  assert.equal(singleDb.category, "Tree Trimming");
  assert.equal(singleDb.service_slug, "tree-trimming");
  assert.equal(singleDb.caption, `${prefix} single — synthetic certification image, not customer work`);
  assert(!(await publicImages("/gallery")).includes(single.alt_text));
  assert(!(await publicImages("/")).includes(single.alt_text));
  pass("single preview/upload, caption/category/service saved; draft absent from public home and gallery");

  stage = "WebP processing and metadata";
  const storedResponse = await fetch(single.public_url);
  assert.equal(storedResponse.status, 200);
  assert(storedResponse.headers.get("content-type").includes("image/webp"));
  const stored = await sharp(Buffer.from(await storedResponse.arrayBuffer())).metadata();
  assert.equal(stored.format, "webp");
  assert.equal(stored.width, 2200);
  assert(stored.height <= 2200);
  assert(!stored.exif && !stored.icc && !stored.xmp && !stored.iptc);
  assert(single.storage_path.endsWith(".webp"));
  pass("gallery converts large JPEG to bounded 2200px WebP and strips embedded EXIF/ICC/XMP/IPTC");
  pass("gallery bucket object is publicly readable by design, independent of draft listing visibility");

  stage = "publish, feature, edit, and unpublish single image";
  await save(single, { published: true, featured: true, caption: `${prefix} edited caption`, category: "Equipment", serviceSlug: "tree-removal", sortOrder: 30 });
  assert((await publicImages("/gallery")).includes(single.alt_text));
  await publicPage.getByText(`${prefix} edited caption`, { exact: true }).waitFor();
  assert((await publicImages("/")).includes(single.alt_text));
  const edited = (await readRecords()).find((item) => item.id === single.id);
  assert.equal(edited.category, "Equipment");
  assert.equal(edited.service_slug, "tree-removal");
  assert.equal(edited.sort_order, 30);
  await save(single, { published: false });
  assert(!(await publicImages("/gallery")).includes(single.alt_text));
  assert(!(await publicImages("/")).includes(single.alt_text));
  pass("Admin edit/feature/publish/unpublish updates home and gallery without rebuild");

  stage = "multiple image upload and before-after ordering";
  const [before, after] = await upload([jpeg, png], "pair", { published: true, featured: true });
  await save(before, { sortOrder: 20, category: "Before & After", beforeAfterGroup: prefix, beforeAfterRole: "before" });
  await save(after, { sortOrder: 10, category: "Before & After", beforeAfterGroup: prefix, beforeAfterRole: "after" });
  const ordered = (await publicImages("/gallery")).filter((alt) => alt.startsWith(prefix));
  assert.deepEqual(ordered, [after.alt_text, before.alt_text]);
  await publicImages("/");
  assert.deepEqual(await publicPage.locator(".before-after-grid img").evaluateAll((images) => images.map((image) => image.alt)), [before.alt_text, after.alt_text]);
  pass("multi-file previews/upload, shared caption/distinct descriptions, display order, and before/after homepage pair");

  stage = "six full-size phone photographs";
  await upload(Array.from({ length: 6 }, (_, index) => ({ ...jpeg, name: `${run}-phone-${index + 1}.jpg` })), "six-phone-photos");
  pass("all six realistically sized 12MP phone photos upload without reducing photo count or Netlify limits");

  stage = "invalid uploads and incomplete-batch isolation";
  expectingRejection = true;
  const stableRecords = await readRecords();
  const sessionsBeforeInvalid = traffic.sessionIds.size;
  await admin.locator("#galleryFiles").setInputFiles({ name: `${run}.txt`, mimeType: "text/plain", buffer: Buffer.from("CUTPRO QA INVALID FILE") });
  await admin.getByRole("status").filter({ hasText: "Use JPG, PNG, or WebP images only." }).waitFor();
  await admin.locator("#galleryFiles").setInputFiles({ name: `${run}.jpg`, mimeType: "image/jpeg", buffer: Buffer.alloc(8 * 1024 * 1024 + 1) });
  await admin.getByRole("status").filter({ hasText: "Each photo must be 8 MB or smaller." }).waitFor();
  await admin.locator("#galleryFiles").setInputFiles(Array.from({ length: 7 }, (_, index) => ({ ...png, name: `${run}-excess-${index}.png` })));
  await admin.getByRole("status").filter({ hasText: "Choose no more than 6 photos." }).waitFor();
  assert.equal(traffic.sessionIds.size, sessionsBeforeInvalid);
  const spoof = { name: `${run}-spoof.jpg`, mimeType: "image/jpeg", buffer: Buffer.from("CUTPRO QA not actual JPEG bytes") };
  await upload([spoof], "spoof", { expected: 422, preview: false });
  await upload([jpeg, spoof], "mixed-incomplete", { expected: 422, preview: false });
  assert.equal((await readRecords()).length, stableRecords.length);
  const incomplete = (await uploadSessions()).filter((session) => !session.result);
  assert.equal(incomplete.length, 2);
  assert(incomplete.every((session) => session.status === "open" && Number.isFinite(Date.parse(session.cleanup_after)) && Date.parse(session.cleanup_after) > Date.parse(session.expires_at)));
  assert(incomplete.some((session) => session.files.some((file) => file.state === "ready")));
  for (const session of incomplete) for (const file of session.files) {
    assert(file.path.startsWith(`staging/${session.id}/`));
    assert.equal(await objectExists(file.path, "gallery-staging"), true);
  }
  expectingRejection = false;
  pass("invalid type, >8MB, and seventh file rejected before upload; spoofed image rejected by server with 422");
  pass("mixed valid/spoof batch creates no partial gallery rows; every temporary path remains tracked for post-expiry cleanup");
  const metrics = await traffic.certify({ minimumLargePhotos: 9 });
  console.log(`DIRECT UPLOAD VERIFIED: ${metrics.largeDirectUploads} large Storage PUTs; ${metrics.appJsonPosts} small JSON app requests.`);

  stage = "cancel deletion preserves record and storage";
  await admin.goto(`${origin}/admin/gallery`, { waitUntil: "networkidle" });
  await remove(single, true);
  assert.equal((await readRecords()).find((item) => item.id === single.id).archived_at, null);
  assert.equal(await objectExists(single.storage_path), true);
  pass("cancel deletion preserves QA gallery row and media");

  stage = "delete and storage cleanup";
  for (const record of created) await remove(record);
  const archived = await readRecords();
  assert.equal(archived.length, created.length);
  assert(archived.every((record) => record.archived_at && !record.published));
  for (const record of archived) assert.equal(await objectExists(record.storage_path), false);
  assert(!(await publicImages("/gallery")).some((alt) => alt.startsWith(prefix)));
  assert(!(await publicImages("/")).some((alt) => alt.startsWith(prefix)));
  pass("confirmed UI deletion archives all nine QA rows, removes their published-bucket objects, and removes public content");
  assert.equal(pageErrors, 0);
  assert.equal(unexpectedConsoleErrors, 0);
  pass("no page exceptions or unexpected browser console errors during valid workflows");
  }
} catch {
  failed = true;
  console.error(`FAIL: ${stage}. Sensitive diagnostic details withheld.`);
} finally {
  if (admin) {
    try {
      const remaining = (await readRecords()).filter((record) => !record.archived_at);
      if (remaining.length) {
        await admin.goto(`${origin}/admin/gallery`, { waitUntil: "networkidle" });
        for (const record of remaining) await remove(record);
        console.log(`CLEANUP: removed ${remaining.length} remaining QA-only gallery item(s) through Admin UI.`);
      }
      const records = await readRecords();
      const active = records.filter((record) => !record.archived_at).length;
      let retainedObjects = 0;
      for (const record of records) if (await objectExists(record.storage_path)) retainedObjects += 1;
      assert.equal(active, 0);
      assert.equal(retainedObjects, 0);
      console.log(`CLEANUP VERIFIED: active QA gallery rows ${active}; retained QA gallery objects ${retainedObjects}.`);
      const sessions = await uploadSessions();
      assert(sessions.every((session) => session.status === "cleaned" || Number.isFinite(Date.parse(session.cleanup_after))));
      console.log(`TEMPORARY UPLOADS: ${sessions.filter((session) => session.status !== "cleaned").length} session(s) remain ledger-tracked until signed-grant expiry; scheduled cleanup is certified separately.`);
    } catch {
      failed = true;
      console.error(`CLEANUP INCOMPLETE for ${prefix}; inspect only this run's QA records.`);
    }
  }
  for (const page of pages) await page.close().catch(() => {});
  await isolatedContext?.close().catch(() => {});
  console.log(JSON.stringify({ run, checksPassed: passed.length, pageErrors, unexpectedConsoleErrors, expectedConsoleErrors, failed }));
  // Never close the shared CDP browser/context or the owner's tabs.
  process.exit(failed ? 1 : 0);
}
