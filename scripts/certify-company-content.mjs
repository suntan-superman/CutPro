import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { defaultCompanyContent } from "../src/data/companyContent.js";
import { getBusinessPhone } from "../src/lib/phone.js";

// Opt-in integration QA: creates one uniquely marked temporary Auth/admin user,
// edits only the Company/About singleton, restores its content and removes that
// exact QA identity. No email is sent; no sessions, passwords or keys are logged.
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const origin = process.env.CUTPRO_QA_ORIGIN || "http://127.0.0.1:3010";
assert.ok(["http://127.0.0.1:3010", "https://cutpro-tree-service.netlify.app"].includes(origin), "Unapproved certification target");
const run = randomUUID();
const email = `cutpro-company-qa-${run}@example.invalid`;
const password = randomBytes(36).toString("base64url");
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const expectedPhone = getBusinessPhone(process.env.CUTPRO_QA_PHONE || process.env.NEXT_PUBLIC_BUSINESS_PHONE?.trim() || process.env.NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY?.trim() || "+16613437663");
const outputDir = `artifacts/company-content-${new URL(origin).hostname}-${run}`;
let browser, userId, original, changed = false, stage = "startup";
const pass = (label) => console.log(`PASS ${label}`);
let pageErrors = 0;

async function noOverflow(page, label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= page.viewportSize().width + 1, `${label} horizontal overflow`);
  pass(`${label} layout fits viewport`);
}

try {
  const { data: previous, error: readError } = await client.from("company_content").select("content").eq("id", "primary").maybeSingle();
  assert.equal(Boolean(readError), false, "Company migration must be installed");
  original = previous?.content || structuredClone(defaultCompanyContent);
  await mkdir(outputDir, { recursive: true });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  publicPage.on("pageerror", () => pageErrors++);
  publicPage.setDefaultTimeout(20000);
  stage = "public pages and phone formatting";
  for (const width of [1440, 768, 390]) {
    await publicPage.setViewportSize({ width, height: 1000 });
    await publicPage.goto(origin);
    await publicPage.waitForLoadState("networkidle");
    assert.equal(await publicPage.locator("h1").innerText(), "Professional Tree Service in Bakersfield");
    assert.equal(await publicPage.title(), "Tree Service in Bakersfield, CA | CUTPRO Tree Service");
    const phones = await publicPage.locator('a[href^="tel:"]').evaluateAll((elements) => elements.map((a) => ({ href: a.getAttribute("href"), text: a.textContent })));
    assert.ok(phones.length >= 4);
    assert.ok(phones.every((phone) => phone.href === expectedPhone.phoneHref));
    assert.ok(phones.some((phone) => phone.text.includes(expectedPhone.phoneDisplay)));
    const schema = await publicPage.locator('script[type="application/ld+json"]').allTextContents();
    assert.ok(schema.some((text) => JSON.parse(text).telephone === expectedPhone.phoneE164));
    const copy = await publicPage.locator("main").innerText();
    assert.doesNotMatch(copy, /owner portal|deployment|managed by the team|as they are published/i);
    await noOverflow(publicPage, `homepage ${width}px`);
    await publicPage.screenshot({ path: `${outputDir}/home-${width}.png`, fullPage: true });
    await publicPage.screenshot({ path: `${outputDir}/hero-${width}.png` });
    if (width === 390) {
      await publicPage.getByRole("button", { name: "Open menu", exact: true }).click();
      assert.equal(await publicPage.locator("#mobile-menu").isVisible(), true);
      assert.equal(await publicPage.locator('.mobile-action-bar a[href^="tel:"]').getAttribute("href"), expectedPhone.phoneHref);
      await publicPage.getByRole("button", { name: "Close menu", exact: true }).click();
    }
    await publicPage.goto(`${origin}/about`);
    assert.equal(await publicPage.locator("h1").innerText(), original.aboutHeading);
    assert.deepEqual(await publicPage.locator(".about-paragraphs p").allTextContents(), original.aboutParagraphs);
    await noOverflow(publicPage, `About ${width}px`);
    await publicPage.screenshot({ path: `${outputDir}/about-${width}.png`, fullPage: true });
    await publicPage.locator(".about-story").screenshot({ path: `${outputDir}/story-${width}.png` });
  }
  pass("homepage H1/title, environment phone display/tel/JSON-LD and About content");
  for (const path of ["/gallery", "/contact", "/free-estimate", "/services", "/services/tree-removal"]) {
    assert.equal((await publicPage.goto(`${origin}${path}`)).status(), 200);
    await noOverflow(publicPage, `${path} 390px`);
  }
  stage = "contact field formatting";
  await publicPage.goto(`${origin}/contact`);
  await publicPage.locator("#contactPhone").fill("6615550100");
  assert.equal(await publicPage.locator("#contactPhone").inputValue(), "(661) 555-0100");
  stage = "contact photo link";
  await publicPage.getByRole("link", { name: /Use the Free Estimate form/ }).click();
  await publicPage.waitForURL("**/free-estimate");
  stage = "estimate service selection";
  await publicPage.locator('.choice-grid label').first().click();
  await publicPage.getByRole("button", { name: /Continue/ }).click();
  stage = "estimate job details";
  await publicPage.locator("#jobDescription").fill("Synthetic UI check only; do not submit or send email.");
  await publicPage.locator('.radio-grid label').filter({ hasText: /^Flexible$/ }).click();
  await publicPage.getByRole("button", { name: /Continue/ }).click();
  assert.ok(await publicPage.locator('input[type="file"]').count());
  pass("Contact phone and link, Estimate services/job/photo steps remain usable (no lead sent)");

  stage = "authorization";
  for (const method of ["GET", "PUT"]) {
    const response = await publicContext.request.fetch(`${origin}/api/admin/company`, { method, ...(method === "PUT" ? { data: original } : {}) });
    assert.equal(response.status(), 401);
  }
  await publicPage.goto(`${origin}/admin/company`);
  assert.equal(new URL(publicPage.url()).pathname, "/admin/login");
  pass("anonymous admin page and Company API access denied");

  stage = "create temporary QA admin";
  const created = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { cutpro_qa_run: run } });
  assert.equal(Boolean(created.error), false, "Temporary identity creation failed");
  userId = created.data.user.id;
  const membership = await client.from("admin_users").insert({ user_id: userId, display_name: `Company QA ${run}` });
  assert.equal(Boolean(membership.error), false, "Temporary admin membership failed");
  const context = await browser.newContext();
  const admin = await context.newPage();
  admin.setDefaultTimeout(20000);
  admin.on("pageerror", () => pageErrors++);
  await admin.goto(`${origin}/admin/login`);
  await admin.locator("#adminEmail").fill(email);
  await admin.locator("#adminPassword").fill(password);
  await admin.getByRole("button", { name: "Sign in", exact: true }).click();
  await admin.waitForURL(`${origin}/admin`);
  stage = "admin editor";
  await admin.goto(`${origin}/admin/company`);
  await admin.locator("#companyName").waitFor();
  assert.equal(await admin.locator("#aboutParagraph1").inputValue(), original.aboutParagraphs[0]);
  for (const width of [1440, 768, 390]) {
    await admin.setViewportSize({ width, height: 1000 });
    await admin.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
    assert.ok(await admin.locator(".company-editor").evaluate((element) => element.getBoundingClientRect().right) <= width, `Company editor ${width}px clipped at right edge`);
    await noOverflow(admin, `Company editor ${width}px`);
    await admin.screenshot({ path: `${outputDir}/editor-${width}.png`, fullPage: true });
    await admin.screenshot({ path: `${outputDir}/editor-top-${width}.png` });
    if (width === 390) {
      assert.ok(await admin.locator(".admin-sidebar").evaluate((element) => element.getBoundingClientRect().right <= 1));
      await admin.getByRole("button", { name: "Open admin menu", exact: true }).click();
      await admin.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
      await admin.getByRole("link", { name: "Company / About", exact: true }).click();
      await admin.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
      assert.ok(await admin.locator(".admin-sidebar").evaluate((element) => element.getBoundingClientRect().right <= 1));
    }
  }
  await admin.locator("#aboutHeading").fill("");
  await admin.getByRole("button", { name: "Save company content", exact: true }).click();
  assert.equal(await admin.locator("#aboutHeading").getAttribute("aria-invalid"), "true");
  await admin.locator("#aboutHeading").fill(original.aboutHeading);
  const revised = `${original.aboutParagraphs[3]} We serve Bakersfield and surrounding communities.`;
  await admin.locator("#aboutParagraph4").fill(revised);
  await admin.getByText("Preview About content", { exact: true }).click();
  assert.ok((await admin.locator(".company-preview").innerText()).includes(revised));
  // Simulate a transient request failure and verify that unsaved text survives.
  await admin.route("**/api/admin/company", async (route) => route.request().method() === "PUT" ? route.fulfill({ status: 503, json: { message: "Temporary QA failure. Retry saving." } }) : route.continue());
  await admin.getByRole("button", { name: "Save company content", exact: true }).click();
  await admin.getByText("Temporary QA failure. Retry saving.", { exact: true }).waitFor();
  assert.equal(await admin.locator("#aboutParagraph4").inputValue(), revised);
  await admin.unroute("**/api/admin/company");
  changed = true;
  const saveResponse = admin.waitForResponse((response) => response.url().endsWith("/api/admin/company") && response.request().method() === "PUT");
  await admin.getByRole("button", { name: "Save company content", exact: true }).click();
  assert.equal((await saveResponse).status(), 200);
  await admin.getByText("Company content saved. Your About page is updated.", { exact: true }).waitFor();
  await admin.reload();
  await admin.locator("#aboutParagraph4").waitFor();
  assert.equal(await admin.locator("#aboutParagraph4").inputValue(), revised);
  await publicPage.goto(`${origin}/about`);
  assert.equal(await publicPage.locator(".about-paragraphs p").nth(3).innerText(), revised);
  const persisted = await client.from("company_content").select("content,updated_by,updated_at").eq("id", "primary").single();
  assert.equal(persisted.data.updated_by, userId);
  assert.ok(persisted.data.updated_at);
  pass("real admin save, reload, public rendering, audit fields, validation, preview and failure recovery");
  // Restore through the same authorized API and verify public reload.
  assert.equal((await context.request.put(`${origin}/api/admin/company`, { data: original })).status(), 200);
  changed = false;
  await publicPage.reload();
  assert.deepEqual(await publicPage.locator(".about-paragraphs p").allTextContents(), original.aboutParagraphs);
  for (const path of ["/admin/gallery", "/admin/testimonials"]) {
    await admin.goto(`${origin}${path}`);
    assert.equal(new URL(admin.url()).pathname, path);
    assert.ok(await admin.locator("h1").count());
  }
  pass("approved company copy restored; Gallery and Testimonials admin screens load");
  await client.from("admin_users").delete().eq("user_id", userId);
  for (const method of ["GET", "PUT"]) {
    assert.equal((await context.request.fetch(`${origin}/api/admin/company`, { method, ...(method === "PUT" ? { data: original } : {}) })).status(), 401);
  }
  pass("signed-in nonadmin cannot read/write company content after membership removal");
  assert.equal(pageErrors, 0, "Unexpected browser runtime errors");
  console.log(`PASS certification finished; screenshots under ${outputDir}`);
} catch {
  console.error(`FAIL Company certification at stage: ${stage}. No credentials or request details logged.`);
  process.exitCode = 1;
} finally {
  if (changed && original) {
    const { error } = await client.from("company_content").upsert({ id: "primary", content: original, updated_by: null });
    if (error) { console.error("Company content restoration requires attention."); process.exitCode = 1; }
  }
  if (userId) {
    // Delete only the uniquely marked identity created by this run.
    const found = await client.auth.admin.getUserById(userId);
    if (found.data?.user?.email === email && found.data.user.user_metadata?.cutpro_qa_run === run) {
      const membership = await client.from("admin_users").delete().eq("user_id", userId);
      const removed = await client.auth.admin.deleteUser(userId);
      if (membership.error || removed.error) { console.error("Temporary QA identity cleanup requires attention."); process.exitCode = 1; }
      else pass("temporary QA identity removed");
    }
  }
  await browser?.close();
}
