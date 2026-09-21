import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createChunks } from "@supabase/ssr";
import { chromium } from "playwright";

// This opt-in test deliberately refreshes the operator's session; refreshed
// cookies are copied back in memory to preserve their browser login. --logout
// additionally exercises the real sign-out UI and leaves the operator signed out.
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const origin = "http://127.0.0.1:3000";
const authName = "sb-wvkihitkavgzgxthzunt-auth-token";
const isSession = (cookie) => cookie.name === authName || new RegExp(`^${authName}\\.\\d+$`).test(cookie.name);
const tokenValue = (cookies) => cookies.filter(isSession).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map((cookie) => cookie.value).join("");
const parseSession = (cookies) => JSON.parse(Buffer.from(tokenValue(cookies).replace(/^base64-/, ""), "base64url").toString("utf8"));
const checks = [];
let stage = "connect";
let isolated;
let page;
let publicPage;
let server;
let originalSettings;
let settingsChanged = false;
let pageErrors = 0;
let consoleErrors = 0;
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`); };

async function saveSettings(settings) {
  await page.goto(`${origin}/admin/settings`);
  await page.locator("#businessHours").fill(settings.business_hours || "");
  await page.locator("#afterHoursNote").fill(settings.after_hours_note || "");
  await page.locator("#announcement").fill(settings.announcement || "");
  await page.locator(".switch-row input").nth(0).setChecked(settings.emergency_service_available);
  await page.locator(".switch-row input").nth(1).setChecked(settings.announcement_enabled);
  const response = page.waitForResponse((res) => res.url() === `${origin}/api/admin/settings` && res.request().method() === "PUT");
  await page.getByRole("button", { name: "Save business settings", exact: true }).click();
  check("authorized business settings save", (await response).status() === 200);
}

try {
  assert.ok(/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL || ""));
  server = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9235");
  const owner = browser.contexts()[0];
  const originalCookies = (await owner.cookies(origin)).filter(isSession);
  check("operator has hardened session cookies", originalCookies.length > 0 && originalCookies.every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax" && !cookie.secure));
  const originalSession = parseSession(originalCookies);
  isolated = await browser.newContext();
  const stale = `base64-${Buffer.from(JSON.stringify({ ...originalSession, expires_at: Math.floor(Date.now() / 1000) - 60 })).toString("base64url")}`;
  await isolated.addCookies(createChunks(authName, stale).map((chunk) => ({ ...originalCookies[0], name: chunk.name, value: chunk.value })));
  page = await isolated.newPage();
  publicPage = await isolated.newPage();
  for (const target of [page, publicPage]) {
    target.setDefaultTimeout(20000);
    target.on("pageerror", () => { pageErrors++; });
    target.on("console", (message) => { if (message.type() === "error") consoleErrors++; });
  }
  stage = "session expiry and proxy refresh";
  await page.goto(`${origin}/admin`);
  check("stale session metadata refreshes into authorized dashboard", new URL(page.url()).pathname === "/admin");
  const refreshedCookies = (await isolated.cookies(origin)).filter(isSession);
  const refreshedSession = parseSession(refreshedCookies);
  check("proxy persisted rotated refresh token and new expiry", refreshedSession.refresh_token !== originalSession.refresh_token && refreshedSession.expires_at > Date.now() / 1000);
  check("refreshed cookies retain HttpOnly and SameSite", refreshedCookies.every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax"));
  // The operator must not be left holding the refresh token rotated by this test.
  await owner.clearCookies({ name: new RegExp(`^${authName}(?:\\.\\d+)?$`) });
  await owner.addCookies(refreshedCookies);
  await page.goto(`${origin}/admin/leads`);
  check("navigation after refresh stays authorized", new URL(page.url()).pathname === "/admin/leads");
  check("session cookies are not exposed to document.cookie", await page.evaluate(() => !document.cookie.includes("-auth-token")));

  stage = "safe settings persistence and restoration";
  const { data: settings, error } = await server.from("business_settings").select("business_hours,after_hours_note,emergency_service_available,announcement,announcement_enabled").eq("id", "primary").single();
  assert.equal(error, null);
  originalSettings = settings;
  const marker = `CUTPRO QA SETTINGS ${randomUUID()} — TEST ONLY`;
  const changed = { business_hours: marker, after_hours_note: `${marker} after-hours`, emergency_service_available: false, announcement: marker, announcement_enabled: true };
  settingsChanged = true;
  await saveSettings(changed);
  const { data: saved, error: savedError } = await server.from("business_settings").select("business_hours,after_hours_note,emergency_service_available,announcement,announcement_enabled").eq("id", "primary").single();
  check("only safe business-control values persist", !savedError && Object.keys(changed).every((key) => saved[key] === changed[key]));
  await publicPage.goto(origin);
  check("announcement publishes and emergency strip hides without build", await publicPage.locator(".announcement").innerText() === marker && await publicPage.locator(".emergency-strip").count() === 0);
  await publicPage.goto(`${origin}/contact`);
  check("business hours and after-hours note appear publicly", (await publicPage.locator("main").innerText()).includes(marker) && (await publicPage.locator("main").innerText()).includes(changed.after_hours_note));
  await saveSettings(originalSettings);
  settingsChanged = false;
  const { data: restored, error: restoreError } = await server.from("business_settings").select("business_hours,after_hours_note,emergency_service_available,announcement,announcement_enabled").eq("id", "primary").single();
  check("original business settings restored exactly", !restoreError && Object.keys(originalSettings).every((key) => restored[key] === originalSettings[key]));
  await publicPage.goto(origin);
  check("temporary QA announcement removed", !(await publicPage.locator("body").innerText()).includes(marker));
  check("session and settings browser checks have no console exceptions", pageErrors === 0 && consoleErrors === 0);

  if (process.argv.includes("--logout")) {
    stage = "real operator logout";
    const ownerPage = await owner.newPage();
    await ownerPage.goto(`${origin}/admin`);
    const response = ownerPage.waitForResponse((res) => res.url() === `${origin}/api/admin/auth/logout` && res.request().method() === "POST");
    await ownerPage.getByRole("button", { name: "Sign out", exact: true }).click();
    check("operator logout redirects successfully", (await response).status() === 303);
    await ownerPage.waitForURL(`${origin}/admin/login`);
    check("logout clears operator's project session cookies", (await owner.cookies(origin)).filter(isSession).length === 0);
    await ownerPage.goto(`${origin}/admin/leads`);
    check("protected route unavailable after logout", new URL(ownerPage.url()).pathname === "/admin/login");
    await ownerPage.close();
    console.log("Operator is now signed out, as expected by the logout test.");
  }
  console.log(`Session/settings certification passed ${checks.length} checks. Tokens and identifiers withheld.`);
} catch {
  console.error(`FAIL session/settings certification at stage: ${stage}. Sensitive details withheld.`);
  process.exitCode = 1;
} finally {
  if (settingsChanged && originalSettings && page) {
    try { await saveSettings(originalSettings); console.log("Original settings restored through UI after interrupted check."); }
    catch { console.error("QA settings restoration needs follow-up before certification."); }
  }
  await isolated?.close().catch(() => {});
}
process.exit(process.exitCode || 0);
