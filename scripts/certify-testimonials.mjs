import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

// Explicitly invoked certification against the operator's isolated signed-in browser.
// Writes occur only through Admin UI; database access below is read-only and scoped
// to this run's unmistakably synthetic content. Never log session/credential data.
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const origin = process.env.CUTPRO_QA_ORIGIN || "http://127.0.0.1:3000";
const runId = process.env.TESTIMONIAL_QA_RUN || String(Date.now());
const prefix = `CUTPRO QA TESTIMONIAL ${runId}`;
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const results = [];
const errors = { page: 0, console: 0 };
let stage = "connect";
let admin;
let publicPage;
let isolatedContext;
let failed = false;
const pass = (name) => { results.push(name); console.log(`PASS: ${name}`); };
const field = (scope, label, control = "input") => scope.locator(".field").filter({ has: scope.page().locator("label").filter({ hasText: label }) }).locator(control);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function row(name) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const cards = admin.locator(".testimonial-admin-item");
    for (let i = 0; i < await cards.count(); i += 1) {
      if (await cards.nth(i).locator("input").first().inputValue() === name) return cards.nth(i);
    }
    await sleep(200);
  }
  throw new Error("QA testimonial row unavailable");
}

async function records() {
  const { data, error } = await client.from("testimonials")
    .select("customer_name,testimonial_text,source,source_url,rating,featured,published,sort_order,archived_at")
    .like("customer_name", `${prefix}%`);
  assert.equal(error, null, "Scoped testimonial read failed");
  return data;
}

async function submit(scope, method) {
  const response = admin.waitForResponse((res) => res.url().includes("/api/admin/testimonials") && res.request().method() === method);
  await scope.locator('button[type="submit"]').click();
  assert.equal((await response).status(), 200, "UI mutation failed");
}

async function publicNames() {
  await publicPage.goto(origin, { waitUntil: "networkidle" });
  return publicPage.locator(".testimonial-card figcaption strong").allTextContents();
}

async function archive(name, confirm = true) {
  const target = await row(name);
  const dialogHandled = new Promise((resolve) => admin.once("dialog", async (dialog) => {
    try {
      assert.equal(dialog.type(), "confirm");
      assert(dialog.message().includes("Archive this testimonial"));
      if (confirm) await dialog.accept(); else await dialog.dismiss();
      resolve(true);
    } catch { resolve(false); }
  }));
  if (confirm) {
    const response = admin.waitForResponse((res) => res.url().includes("/api/admin/testimonials/") && res.request().method() === "DELETE");
    await target.getByRole("button", { name: "Archive", exact: true }).click();
    assert.equal(await dialogHandled, true, "Native confirmation failed");
    assert.equal((await response).status(), 200, "UI archive failed");
  } else {
    await target.getByRole("button", { name: "Archive", exact: true }).click();
    assert.equal(await dialogHandled, true, "Native cancellation failed");
  }
}

try {
  const browser = await chromium.connectOverCDP(process.env.CUTPRO_QA_CDP || "http://127.0.0.1:9235");
  const ownerContext = browser.contexts()[0];
  isolatedContext = await chromium.launchPersistentContext(fileURLToPath(new URL(`../artifacts/testimonial-browser-${runId}/`, import.meta.url)), { channel: "chrome", headless: true });
  await isolatedContext.addCookies(await ownerContext.cookies(origin));
  admin = await isolatedContext.newPage();
  publicPage = await isolatedContext.newPage();
  for (const page of [admin, publicPage]) {
    page.on("pageerror", () => { errors.page += 1; });
    page.on("console", (message) => { if (message.type() === "error") errors.console += 1; });
    page.setDefaultTimeout(15000);
  }
  await admin.goto(`${origin}/admin/testimonials`, { waitUntil: "networkidle" });
  assert.equal(new URL(admin.url()).pathname, "/admin/testimonials", "Admin session not available");
  pass("authorized testimonial Admin UI loads");
  if (process.argv.includes("--archive-only")) {
    stage = "recover archive cancellation";
    const active = (await records()).filter((item) => !item.archived_at);
    assert.equal(active.length, 2);
    await archive(active[0].customer_name, false);
    assert.equal((await records()).find((item) => item.customer_name === active[0].customer_name).archived_at, null);
    assert.equal((await publicNames()).includes(active[0].customer_name), true);
    pass("archive cancellation branch preserves record and public visibility");
    stage = "recover archive confirmation";
    for (const item of active) await archive(item.customer_name);
    assert.equal((await records()).every((item) => item.archived_at && !item.published), true);
    assert.equal((await publicNames()).some((name) => name.startsWith(prefix)), false);
    await admin.reload({ waitUntil: "networkidle" });
    const remainingNames = await admin.locator(".testimonial-admin-item input").evaluateAll((inputs) => inputs.map((input) => input.value));
    assert.equal(remainingNames.some((name) => name.startsWith(prefix)), false);
    pass("archive confirmation branch hides both QA records from Admin and public homepage");
  } else {
  const add = admin.locator(".admin-card").filter({ has: admin.getByRole("heading", { name: "Add a genuine testimonial" }) });
  const a = `${prefix} A`;
  const editedA = `${prefix} A EDITED`;
  const b = `${prefix} B`;
  stage = "create unpublished A";
  await field(add, "Displayed customer name").fill(a);
  await field(add, /^Testimonial/, "textarea").fill("TEST ONLY — NOT A CUSTOMER REVIEW. Draft certification A.");
  await field(add, /^Source$/, "select").selectOption("Other");
  await field(add, /^Source link$/).fill("https://example.invalid/qa");
  await field(add, "Rating, if supplied", "select").selectOption("3");
  await field(add, "Display order").fill("40");
  await submit(add, "POST");
  await row(a);
  let data = await records();
  assert.equal(data.length, 1);
  assert.equal(data[0].published, false);
  assert.equal(data[0].source, "Other");
  assert.equal(data[0].source_url, "https://example.invalid/qa");
  assert.equal(data[0].rating, 3);
  assert.equal(data[0].sort_order, 40);
  assert.equal((await publicNames()).includes(a), false);
  pass("draft creation persists source/link/rating/order and stays off public homepage");

  stage = "create published B";
  await field(add, "Displayed customer name").fill(b);
  await field(add, /^Testimonial/, "textarea").fill("TEST ONLY — NOT A CUSTOMER REVIEW. Synthetic certification B.");
  await field(add, /^Source$/, "select").selectOption("Other");
  await field(add, /^Source link$/).fill("https://example.invalid/qa");
  await field(add, "Rating, if supplied", "select").selectOption("2");
  await field(add, "Display order").fill("20");
  await add.getByLabel("Published", { exact: true }).check();
  await submit(add, "POST");
  await row(b);
  assert.equal((await publicNames()).includes(b), true);
  pass("published nonfeatured testimonial appears immediately on public homepage");

  stage = "edit and feature A";
  let target = await row(a);
  await field(target, "Displayed customer name").fill(editedA);
  await field(target, /^Testimonial/, "textarea").fill("TEST ONLY — NOT A CUSTOMER REVIEW. Edited synthetic certification A.");
  await field(target, /^Source link$/).fill("https://example.invalid/qa?edited=1");
  await field(target, "Rating, if supplied", "select").selectOption("4");
  await target.getByLabel("Feature on homepage").check();
  await target.getByLabel("Published", { exact: true }).check();
  await submit(target, "PATCH");
  data = await records();
  const edited = data.find((item) => item.customer_name === editedA);
  assert.equal(edited.rating, 4);
  assert.equal(edited.featured, true);
  assert.equal(edited.published, true);
  assert.equal(edited.source_url, "https://example.invalid/qa?edited=1");
  assert.match(edited.testimonial_text, /Edited synthetic/);
  let names = (await publicNames()).filter((name) => name.startsWith(prefix));
  assert.deepEqual(names, [editedA, b]);
  const card = publicPage.locator(".testimonial-card").filter({ hasText: editedA });
  assert.equal(await card.locator(".stars").getAttribute("aria-label"), "4 out of 5 stars");
  assert.equal(await card.getByRole("link", { name: "View on Other" }).getAttribute("href"), "https://example.invalid/qa?edited=1");
  assert.equal(await card.getByRole("link", { name: "View on Other" }).getAttribute("rel"), "noopener noreferrer");
  pass("edit name/text/link/rating persists and featured sorting plus public source/stars render");

  stage = "remove feature and reorder";
  target = await row(editedA);
  await target.getByLabel("Feature on homepage").uncheck();
  await field(target, "Display order").fill("50");
  await submit(target, "PATCH");
  names = (await publicNames()).filter((name) => name.startsWith(prefix));
  assert.deepEqual(names, [b, editedA]);
  target = await row(editedA);
  await field(target, "Display order").fill("10");
  await submit(target, "PATCH");
  names = (await publicNames()).filter((name) => name.startsWith(prefix));
  assert.deepEqual(names, [editedA, b]);
  pass("unfeature and display-order changes immediately reorder public testimonials");

  stage = "unpublish then republish";
  target = await row(editedA);
  await target.getByLabel("Published", { exact: true }).uncheck();
  await submit(target, "PATCH");
  names = await publicNames();
  assert.equal(names.includes(editedA), false);
  assert.equal(names.includes(b), true);
  target = await row(editedA);
  await target.getByLabel("Published", { exact: true }).check();
  await submit(target, "PATCH");
  assert.equal((await publicNames()).includes(editedA), true);
  pass("unpublish hides only target and republish restores it immediately");

  stage = "archive cancellation";
  await archive(b, false);
  assert.equal((await records()).find((item) => item.customer_name === b).archived_at, null);
  assert.equal((await publicNames()).includes(b), true);
  pass("archive cancellation preserves record and public visibility");

  stage = "archive confirmation";
  await archive(b);
  await archive(editedA);
  data = await records();
  assert.equal(data.length, 2);
  assert.equal(data.every((item) => item.archived_at && !item.published), true);
  names = await publicNames();
  assert.equal(names.some((name) => name.startsWith(prefix)), false);
  await admin.reload({ waitUntil: "networkidle" });
  const activeNames = await admin.locator(".testimonial-admin-item input").evaluateAll((inputs) => inputs.map((input) => input.value));
  assert.equal(activeNames.some((name) => name.startsWith(prefix)), false);
  pass("archive confirmation hides both QA records from Admin and public homepage");
  }
} catch {
  failed = true;
  console.error(`FAIL: testimonial certification stage '${stage}'; sensitive details withheld.`);
} finally {
  if (admin) {
    try {
      await admin.goto(`${origin}/admin/testimonials`, { waitUntil: "networkidle" });
      for (const item of (await records()).filter((item) => !item.archived_at)) await archive(item.customer_name);
      const remaining = (await records()).filter((item) => !item.archived_at || item.published);
      assert.equal(remaining.length, 0);
      console.log("PASS: no active or published QA testimonials remain for this run");
    } catch {
      failed = true;
      console.error("FAIL: QA testimonial cleanup requires follow-up; details withheld.");
    }
  }
  console.log(JSON.stringify({ runId, checksPassed: results.length, pageErrors: errors.page, consoleErrors: errors.console, failed }));
  if (publicPage) await publicPage.close();
  if (admin) await admin.close();
  await isolatedContext?.close().catch(() => {});
  // Never close the shared browser or log the owner out.
  process.exit(failed ? 1 : 0);
}
