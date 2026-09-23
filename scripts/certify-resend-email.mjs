import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import sharp from "sharp";

// Explicit opt-in certification. This sends two clearly synthetic messages to
// RESEND_QA_CUSTOMER_EMAIL (or the configured owner destination) and creates one
// retained QA lead in the existing Supabase project.
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const origin = process.env.CUTPRO_QA_ORIGIN || "http://127.0.0.1:3014";
const customerEmail = process.env.RESEND_QA_CUSTOMER_EMAIL || process.env.LEAD_NOTIFICATION_EMAIL;
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
const replyTo = process.env.EMAIL_REPLY_TO;
const marker = `CUTPRO RESEND CERTIFICATION TEST — NOT A CUSTOMER LEAD — ${randomUUID()}`;
assert.ok(apiKey && customerEmail && from, "Set Resend, owner destination, and sender environment variables first.");
assert.equal(from, "CutPro Tree Service <notifications@cutprotree.com>", "EMAIL_FROM must use the verified CutPro sender.");
assert.ok(projectUrl && secretKey, "Supabase server configuration is required.");

const server = createClient(projectUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const browser = await chromium.launch({ channel: "chrome", headless: true });
let lead;
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const browserErrors = [];
  page.on("pageerror", () => browserErrors.push("pageerror"));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push("console-error"); });
  assert.equal((await page.goto(`${origin}/free-estimate`)).status(), 200);
  await page.locator(".choice-grid label").filter({ hasText: "Tree Trimming" }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.locator("#jobDescription").fill("CUTPRO RESEND CERTIFICATION TEST — NOT A CUSTOMER LEAD");
  await page.locator(".radio-grid label").filter({ hasText: "Flexible" }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  const image = await sharp({ create: { width: 320, height: 240, channels: 3, background: { r: 35, g: 96, b: 71 } } }).jpeg({ quality: 80 }).toBuffer();
  await page.locator('input[type="file"]').setInputFiles({ name: "CUTPRO-RESEND-QA.jpg", mimeType: "image/jpeg", buffer: image });
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.locator("#firstName").fill("Workside");
  await page.locator("#lastName").fill("Email QA");
  await page.locator("#phone").fill("2134661363");
  await page.locator("#email").fill(customerEmail);
  await page.locator("#propertyAddress").fill("123 Synthetic QA Lane");
  await page.locator("#city").fill("Bakersfield");
  await page.locator("#zip").fill("93301");
  await page.locator("#preferredContactMethod").selectOption("Email");
  await page.locator("#customerNotes").fill(marker);
  await page.getByRole("button", { name: /Continue/ }).click();
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const responsePromise = page.waitForResponse((response) => response.url() === `${origin}/api/estimate` && response.request().method() === "POST", { timeout: 180000 });
  await page.getByRole("button", { name: "Send my request", exact: true }).click();
  const response = await responsePromise;
  const result = await response.json();
  assert.equal(response.status(), 200);
  assert.equal(result.ok, true);
  assert.match(result.reference, /^CP-\d{8}-[A-F0-9]+$/);
  assert.deepEqual(result.notificationStatus, { ownerSent: true, customerSent: true }, "Both Resend send attempts must be accepted after persistence.");
  await page.locator(".form-success").waitFor();
  assert.deepEqual(browserErrors, []);

  const { data: rows, error } = await server.from("leads").select("*").eq("customer_notes", marker);
  if (error) throw error;
  lead = rows?.find((row) => row.reference === result.reference);
  assert.ok(lead, "The submitted lead was not found in Supabase.");
  assert.equal(rows.filter((row) => row.reference === result.reference).length, 1);
} finally {
  await browser.close();
}

// The public form's notes marker is not user-editable in this short QA path;
// locate the exact returned reference instead and verify persistence/ownership.
const { data: persisted, error: persistedError } = await server.from("leads").select("*").eq("reference", lead.reference).single();
assert.ok(!persistedError && persisted);
assert.equal(persisted.source, "estimate");
assert.equal(persisted.photo_references.length, 1);
for (const photo of persisted.photo_references) {
  const publicResponse = await fetch(`${projectUrl}/storage/v1/object/public/lead-photos/${photo.path}`);
  assert.equal(publicResponse.ok, false, "Lead photo must remain private.");
  const { data: privatePhoto, error } = await server.storage.from("lead-photos").download(photo.path);
  assert.ok(!error && privatePhoto, "Server must retain access to the private QA photo.");
}

console.log(JSON.stringify({
  passed: true,
  reference: persisted.reference,
  exactlyOneLead: true,
  privatePhoto: true,
  ownerEmailAccepted: true,
  customerEmailAccepted: true,
  sender: from,
  replyToConfigured: Boolean(replyTo),
  note: "Check the recipient mailbox and Resend event/authentication details for final delivery confirmation. The restricted API key intentionally cannot list or read sent messages.",
}));
