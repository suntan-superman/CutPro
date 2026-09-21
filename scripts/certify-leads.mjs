import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import sharp from "sharp";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const origin = "http://127.0.0.1:3000";
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let marker = `CUTPRO QA LEAD ${randomUUID()}`;
const resumeId = process.argv.find((argument) => argument.startsWith("--resume-id="))?.slice(12);
const checks = [];
let stage = "setup";
let publicContext;
let adminPage;
let leadId;
const browserErrors = [];
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
  console.log(`PASS ${name}`);
}
function observe(page) {
  page.on("pageerror", () => browserErrors.push("pageerror"));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push("console-error");
  });
}

try {
  assert.equal(projectUrl, "https://wvkihitkavgzgxthzunt.supabase.co");
  assert.ok(!process.env.RESEND_API_KEY, "QA assumes email delivery is unconfigured");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const server = createClient(projectUrl, process.env.SUPABASE_SECRET_KEY, options);
  const anonymous = createClient(projectUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  let result;
  if (resumeId) {
    const { data: retained, error } = await server.from("leads").select("reference,customer_notes,job_description,email").eq("id", resumeId).single();
    assert.ok(!error && retained.customer_notes.startsWith("CUTPRO QA LEAD ") && retained.email === "cutpro-qa@example.invalid" && retained.job_description === "CUTPRO ADMIN CERTIFICATION TEST — NOT A CUSTOMER LEAD");
    marker = retained.customer_notes;
    result = { reference: retained.reference };
    leadId = resumeId;
    console.log("Resuming retained QA lead; no new estimate will be created.");
  }
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9235");
  const ownerContext = browser.contexts()[0];
  adminPage = await ownerContext.newPage();
  adminPage.setDefaultTimeout(20000);
  observe(adminPage);
  await adminPage.goto(`${origin}/admin/leads`);
  check("authorized lead manager opens", new URL(adminPage.url()).pathname === "/admin/leads");
  publicContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await publicContext.newPage();
  page.setDefaultTimeout(20000);
  observe(page);
  const jpeg = await sharp({ create: { width: 2600, height: 1700, channels: 3, background: "#608d50" } })
    .withMetadata({ exif: { IFD0: { Artist: "CUTPRO QA TEST", Copyright: "TEST IMAGE ONLY" } } }).jpeg().toBuffer();
  const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#edb943" } }).png().toBuffer();
  check("source JPEG contains metadata for stripping test", Boolean((await sharp(jpeg).metadata()).exif));
  const photoA = { name: "CUTPRO-QA-estimate-A.jpg", mimeType: "image/jpeg", buffer: jpeg };
  const photoB = { name: "CUTPRO-QA-estimate-B.png", mimeType: "image/png", buffer: png };
  const fields = {
    firstName: "Workside", lastName: "QA", phone: "661-555-0100", email: "cutpro-qa@example.invalid",
    propertyAddress: "123 QA Test Lane — NOT A CUSTOMER", city: "Bakersfield", zip: "93301",
    bestContactTime: "TEST ONLY — do not contact", customerNotes: marker,
  };

  if (!resumeId) {
  stage = "public estimate service and job steps";
  await page.goto(`${origin}/free-estimate`);
  await page.locator(".choice-grid label").filter({ hasText: "Tree Trimming" }).click();
  await page.locator(".choice-grid label").filter({ hasText: "Stump Grinding" }).click();
  await page.getByRole("button", { name: "Continue", exact: false }).click();
  await page.locator("#jobDescription").fill("CUTPRO ADMIN CERTIFICATION TEST — NOT A CUSTOMER LEAD");
  await page.locator(".radio-grid label").filter({ hasText: "Within a week" }).click();
  await page.locator("#approximateCount").fill("2 trees and 1 stump — TEST ONLY");
  await page.locator("#preferredTimeframe").fill("QA only — no appointment requested");
  await page.getByRole("button", { name: "Continue", exact: false }).click();

  stage = "photo validation and retained previews";
  const chooser = page.locator('input[type="file"]');
  await chooser.setInputFiles({ name: "CUTPRO-QA-invalid.txt", mimeType: "text/plain", buffer: Buffer.from("QA ONLY") });
  check("invalid estimate file rejected in UI", await page.getByRole("alert").filter({ hasText: "unsupported image type" }).isVisible());
  await chooser.setInputFiles({ name: "CUTPRO-QA-oversized.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(8 * 1024 * 1024 + 1) });
  check("oversized estimate file rejected in UI", await page.getByRole("alert").filter({ hasText: "larger than 8 MB" }).isVisible());
  await chooser.setInputFiles(photoA);
  await chooser.setInputFiles(photoB);
  await page.waitForFunction(() => [...document.querySelectorAll(".photo-preview img")].length === 2 && [...document.querySelectorAll(".photo-preview img")].every((image) => image.complete && image.naturalWidth > 0));
  check("incrementally added photo previews both render", true);
  await page.getByRole("button", { name: `Remove ${photoB.name}`, exact: true }).click();
  check("retained photo preview survives removal of another", await page.locator(".photo-preview img").evaluate((image) => image.complete && image.naturalWidth > 0));
  await chooser.setInputFiles(photoB);
  await page.waitForFunction(() => [...document.querySelectorAll(".photo-preview img")].length === 2 && [...document.querySelectorAll(".photo-preview img")].every((image) => image.complete && image.naturalWidth > 0));
  await page.getByRole("button", { name: "Continue", exact: false }).click();

  stage = "contact details and estimate submission";
  for (const [name, value] of Object.entries(fields)) await page.locator(`#${name}`).fill(value);
  await page.locator("#preferredContactMethod").selectOption("Email");
  await page.getByRole("button", { name: "Continue", exact: false }).click();
  check("review shows selected photos", await page.getByText("2 selected", { exact: true }).isVisible());
  const responsePromise = page.waitForResponse((response) => response.url() === `${origin}/api/estimate` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Send my request", exact: true }).click();
  const response = await responsePromise;
  result = await response.json();
  check("public estimate accepted without Resend", response.status() === 200 && result.ok && !result.photoWarning);
  await page.locator(".form-success").waitFor();
  check("confirmation displays generated reference", await page.locator(".reference-card strong").innerText() === result.reference && /^CP-\d{8}-[A-F0-9]+$/.test(result.reference));
  }

  stage = "database persistence and idempotency";
  const { data: rows, error: readError } = await server.from("leads").select("*").eq("customer_notes", marker);
  check("exactly one persistent lead", !readError && rows.length === 1);
  const lead = rows[0];
  leadId = lead.id;
  check("lead customer/property/contact fields persisted", lead.first_name === fields.firstName && lead.last_name === fields.lastName && lead.phone === fields.phone && lead.email === fields.email && lead.property_address === fields.propertyAddress && lead.city === fields.city && lead.zip === fields.zip && lead.preferred_contact_method === "Email" && lead.best_contact_time === fields.bestContactTime);
  check("lead job/services/urgency/notes persisted", lead.job_description === "CUTPRO ADMIN CERTIFICATION TEST — NOT A CUSTOMER LEAD" && lead.urgency === "Within a week" && lead.services.includes("tree-trimming") && lead.services.includes("stump-grinding") && lead.approximate_count === "2 trees and 1 stump — TEST ONLY" && lead.preferred_timeframe === "QA only — no appointment requested" && lead.customer_notes === marker && lead.source === "estimate" && lead.status === "new");
  check("two photo references persisted", lead.photo_references.length === 2);
  // Chromium's request inspection can omit multipart file bytes. Reconstruct
  // the same QA fields/token/photos rather than replaying an incomplete capture.
  const replayForm = new FormData();
  replayForm.set("payload", JSON.stringify({ ...fields, submissionToken: lead.submission_token,
    startedAt: Date.now() - 5000, website: "", turnstileToken: "", services: lead.services,
    urgency: lead.urgency, jobDescription: lead.job_description, approximateCount: lead.approximate_count,
    preferredTimeframe: lead.preferred_timeframe, preferredContactMethod: lead.preferred_contact_method,
  }));
  replayForm.append("photos", new Blob([jpeg], { type: "image/jpeg" }), photoA.name);
  replayForm.append("photos", new Blob([png], { type: "image/png" }), photoB.name);
  const replay = await fetch(`${origin}/api/estimate`, { method: "POST", body: replayForm });
  const replayResult = await replay.json();
  check("replayed submission returns same reference as duplicate", replay.status === 200 && replayResult.duplicate === true && replayResult.reference === result.reference);
  const { count, error: countError } = await server.from("leads").select("id", { count: "exact", head: true }).eq("submission_token", lead.submission_token);
  check("idempotent replay creates no second lead", !countError && count === 1);
  const { data: objects, error: listError } = await server.storage.from("lead-photos").list(lead.id);
  check("storage contains exactly the two referenced photos", !listError && objects.length === 2 && objects.every((object) => lead.photo_references.some((photo) => photo.path === `${lead.id}/${object.name}`)));
  const { data: publicRows, error: publicError } = await anonymous.from("leads").select("id").eq("id", lead.id);
  check("public key cannot read the persisted lead", publicError?.code === "42501" || (!publicError && publicRows.length === 0));
  for (const photo of lead.photo_references) {
    const direct = await fetch(`${projectUrl}/storage/v1/object/public/lead-photos/${photo.path}`);
    check("private photo denied through public storage URL", !direct.ok);
    const { data: publicPhoto, error: privateError } = await anonymous.storage.from("lead-photos").download(photo.path);
    check("private photo denied to anonymous download", Boolean(privateError) && !publicPhoto);
    const { data: image, error: downloadError } = await server.storage.from("lead-photos").download(photo.path);
    check("server can retrieve stored lead photo", !downloadError && Boolean(image));
    const metadata = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
    check("lead photo normalized to resized metadata-free WebP", metadata.format === "webp" && metadata.width <= 2000 && metadata.height <= 2000 && !metadata.exif && !metadata.icc && !metadata.xmp && photo.storedType === "image/webp");
  }

  stage = "lead manager search/filter/detail";
  await adminPage.reload();
  await adminPage.locator("#leadSearch").fill(result.reference);
  await adminPage.locator("#statusFilter").selectOption("new");
  await adminPage.locator("#serviceFilter").selectOption("tree-trimming");
  await adminPage.getByRole("button", { name: "Apply filters", exact: true }).click();
  await adminPage.locator(`a[href="/admin/leads/${lead.id}"]`).waitFor();
  check("lead search/status/service filters find the QA lead", await adminPage.locator(`a[href="/admin/leads/${lead.id}"]`).count() === 1);
  await adminPage.locator("#statusFilter").selectOption("won");
  await adminPage.getByRole("button", { name: "Apply filters", exact: true }).click();
  await adminPage.getByText("No leads match these filters.", { exact: true }).waitFor();
  check("nonmatching status filter excludes QA lead", true);
  await adminPage.goto(`${origin}/admin/leads/${lead.id}`);
  check("authorized lead detail and contact links render", await adminPage.getByRole("heading", { name: "Workside QA", exact: true }).isVisible() && await adminPage.locator('a[href="tel:661-555-0100"]').count() === 1 && await adminPage.locator('a[href="mailto:cutpro-qa@example.invalid"]').count() === 1);
  await adminPage.waitForFunction(() => [...document.querySelectorAll(".lead-photo-grid img")].length === 2 && [...document.querySelectorAll(".lead-photo-grid img")].every((image) => image.complete && image.naturalWidth > 0));
  check("authorized signed photo previews render", true);
  for (const anchor of await adminPage.locator(".lead-photo-grid a").all()) {
    const signedUrl = await anchor.getAttribute("href");
    const signed = await fetch(signedUrl);
    check("intended signed-photo URL loads", signed.ok);
  }

  stage = "workflow statuses and private notes";
  const notes = `${marker} — certified follow-up notes; do not contact this fake customer.`;
  for (const status of ["contacted", "estimate_scheduled", "won", "lost", "won"]) {
    await adminPage.locator("#leadStatus").selectOption(status);
    await adminPage.locator("#internalNotes").fill(notes);
    const savePromise = adminPage.waitForResponse((r) => r.url() === `${origin}/api/admin/leads/${lead.id}` && r.request().method() === "PATCH");
    await adminPage.getByRole("button", { name: "Save follow-up", exact: true }).click();
    check(`authorized lead status mutation ${status}`, (await savePromise).status() === 200);
    const { data: updated, error: updateError } = await server.from("leads").select("status,internal_notes").eq("id", lead.id).single();
    check(`lead status ${status} and notes persisted`, !updateError && updated.status === status && updated.internal_notes === notes);
  }
  await adminPage.reload();
  check("saved status and internal notes survive reload", await adminPage.locator("#leadStatus").inputValue() === "won" && await adminPage.locator("#internalNotes").inputValue() === notes);
  const unauthDetail = await publicContext.request.get(`${origin}/admin/leads/${lead.id}`, { maxRedirects: 0 });
  check("unauthenticated real lead-detail route redirects", unauthDetail.status() === 307 && unauthDetail.headers().location === "/admin/login");
  const rsc = await publicContext.request.get(`${origin}/admin/leads/${lead.id}`, { headers: { RSC: "1" } });
  const rscBody = await rsc.text();
  check("real lead RSC payload has no QA PII or signed URLs", rscBody.includes("NEXT_REDIRECT;replace;/admin/login;307;") && !rscBody.includes(fields.propertyAddress) && !rscBody.includes(marker) && !rscBody.includes("/storage/v1/object/sign/"));
  check("no browser console/page errors during lead workflow", browserErrors.length === 0);
  console.log(`Lead certification passed ${checks.length} checks. Retained QA lead ID: ${lead.id}; reference: ${lead.reference}.`);
} catch {
  console.error(`FAIL lead certification at stage: ${stage}. Sensitive exception details withheld.`);
  if (leadId) console.log(`QA lead retained for diagnosis: ${leadId}`);
  process.exitCode = 1;
} finally {
  await adminPage?.close().catch(() => {});
  await publicContext?.close().catch(() => {});
}
process.exit(process.exitCode || 0);
