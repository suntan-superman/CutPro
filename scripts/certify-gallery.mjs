import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import sharp from "sharp";

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

function pass(label) { passed.push(label); console.log(`PASS: ${label}`); }
async function readRecords() {
  const { data, error } = await client.from("gallery_items").select("*").like("alt_text", `${prefix}%`);
  assert.equal(error, null, "QA gallery read failed");
  return data;
}
async function objectPaths() {
  const year = String(new Date().getUTCFullYear());
  const { data, error } = await client.storage.from("gallery-media").list(year, { limit: 1000 });
  assert.equal(error, null, "QA storage read failed");
  assert(data.length < 1000, "Storage listing needs pagination");
  return data.filter((item) => item.id).map((item) => `${year}/${item.name}`).sort();
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
  const responsePromise = admin.waitForResponse((response) => response.url() === `${origin}/api/admin/gallery` && response.request().method() === "POST");
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
  const storageBefore = await objectPaths();
  pass("signed-in Gallery Manager loads");

  stage = "single image upload and private draft listing";
  const jpegBuffer = await sharp({ create: { width: 2800, height: 1800, channels: 3, background: "#647b63" } })
    .withExif({ IFD0: { Artist: "CUTPRO QA ONLY", ImageDescription: prefix } }).jpeg({ quality: 88 }).toBuffer();
  assert((await sharp(jpegBuffer).metadata()).exif);
  const pngBuffer = await sharp({ create: { width: 960, height: 640, channels: 3, background: "#31564e" } }).png().toBuffer();
  const jpeg = { name: `${run}-before.jpg`, mimeType: "image/jpeg", buffer: jpegBuffer };
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

  stage = "invalid uploads and mixed-batch rollback";
  expectingRejection = true;
  const stableRecords = await readRecords();
  const stableObjects = await objectPaths();
  await upload([{ name: `${run}.txt`, mimeType: "text/plain", buffer: Buffer.from("CUTPRO QA INVALID FILE") }], "invalid-type", { expected: 422, preview: false });
  await upload([{ name: `${run}.jpg`, mimeType: "image/jpeg", buffer: Buffer.alloc(8 * 1024 * 1024 + 1) }], "oversized", { expected: 422, preview: false });
  const spoof = { name: `${run}-spoof.jpg`, mimeType: "image/jpeg", buffer: Buffer.from("CUTPRO QA not actual JPEG bytes") };
  await upload([spoof], "spoof", { expected: 422, preview: false });
  await upload([jpeg, spoof], "mixed-rollback", { expected: 422, preview: false });
  assert.equal((await readRecords()).length, stableRecords.length);
  assert.deepEqual(await objectPaths(), stableObjects);
  expectingRejection = false;
  pass("invalid type, >8MB, and spoofed signature rejected with 422");
  pass("mixed valid/spoof batch rolls back uploaded object; no partial rows or orphaned objects");

  stage = "cancel deletion preserves record and storage";
  await admin.goto(`${origin}/admin/gallery`, { waitUntil: "networkidle" });
  await remove(single, true);
  assert.equal((await readRecords()).find((item) => item.id === single.id).archived_at, null);
  assert((await objectPaths()).includes(single.storage_path));
  pass("cancel deletion preserves QA gallery row and media");

  stage = "delete and storage cleanup";
  for (const record of created) await remove(record);
  const archived = await readRecords();
  assert.equal(archived.length, created.length);
  assert(archived.every((record) => record.archived_at && !record.published));
  assert.deepEqual(await objectPaths(), storageBefore);
  assert(!(await publicImages("/gallery")).some((alt) => alt.startsWith(prefix)));
  assert(!(await publicImages("/")).some((alt) => alt.startsWith(prefix)));
  pass("confirmed UI deletion archives all 3 QA rows, removes all QA storage objects, and removes public content");
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
      const paths = await objectPaths();
      const active = records.filter((record) => !record.archived_at).length;
      const retainedObjects = records.filter((record) => paths.includes(record.storage_path)).length;
      assert.equal(active, 0);
      assert.equal(retainedObjects, 0);
      console.log(`CLEANUP VERIFIED: active QA gallery rows ${active}; retained QA gallery objects ${retainedObjects}.`);
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
