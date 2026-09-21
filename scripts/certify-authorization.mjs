import { randomBytes, randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

// Live, local-only certification. Never log credentials, cookies, bodies, or PII.
// Uses an isolated context and deletes only its own marked temporary Auth user.
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const origin = "http://127.0.0.1:3000";
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const marker = `cutpro-qa-nonadmin-${randomUUID()}`;
const email = `${marker}@example.invalid`;
const password = `${randomBytes(36).toString("base64url")}aA!9`;
const unknownId = randomUUID();
const pages = ["/admin", "/admin/leads", `/admin/leads/${unknownId}`, "/admin/gallery", "/admin/testimonials", "/admin/settings"];
const mutations = [
  ["POST", "/api/admin/gallery"],
  ["PATCH", `/api/admin/gallery/${unknownId}`],
  ["DELETE", `/api/admin/gallery/${unknownId}`],
  ["POST", "/api/admin/testimonials"],
  ["PATCH", `/api/admin/testimonials/${unknownId}`],
  ["DELETE", `/api/admin/testimonials/${unknownId}`],
  ["PATCH", `/api/admin/leads/${unknownId}`],
  ["PUT", "/api/admin/settings"],
];
let context;
let service;
let createdUserId;
let currentCheck = "configuration";
let checks = 0;
let failed = false;
let pageErrors = 0;

function check(condition, name) {
  currentCheck = name;
  if (!condition) throw new Error("Certification assertion failed");
  checks += 1;
  console.log(`PASS: ${name}`);
}

async function checkProtectedPages(label) {
  for (const path of pages) {
    for (const rsc of [false, true]) {
      currentCheck = `${label}: ${path} ${rsc ? "RSC" : "HTML"} denies access`;
      let target = `${origin}${path}`;
      let denied = false;
      for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
        const response = await context.request.get(target, {
          headers: rsc ? { RSC: "1", "Next-Url": "/admin" } : {},
          maxRedirects: 0,
          timeout: 30000,
        });
        const location = response.headers().location;
        if (location && new URL(location, origin).pathname === "/admin/login") {
          denied = true;
          break;
        }
        if (location && [301, 302, 303, 307, 308].includes(response.status())) {
          const next = new URL(location, origin);
          if (next.origin !== origin || next.pathname !== path) break;
          target = next.href;
          continue;
        }
        const body = await response.text();
        denied = /NEXT_REDIRECT;(?:replace|push);\/admin\/login(?:\?[^;]*)?;30[37];/.test(body);
        break;
      }
      check(denied, currentCheck);
    }
  }
}

async function checkProtectedMutations(label) {
  for (const [method, path] of mutations) {
    currentCheck = `${label}: ${method} ${path.replace(unknownId, "[id]")} returns 401`;
    const response = await context.request.fetch(`${origin}${path}`, {
      method,
      ...(method === "DELETE" ? {} : { data: "{", headers: { "content-type": "application/json" } }),
      maxRedirects: 0,
      timeout: 30000,
    });
    check(response.status() === 401, currentCheck);
  }
}

async function checkTableIsolation(client, label) {
  for (const table of ["admin_users", "leads", "gallery_items", "testimonials", "business_settings"]) {
    currentCheck = `${label}: ${table} exposes no rows through direct Supabase access`;
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
    const denied = !error && count === 0;
    const permissionDenied = error && (error.code === "42501" || error.code === "PGRST301");
    check(denied || permissionDenied, currentCheck);
  }
}

try {
  check(projectUrl && publishableKey && secretKey, "required configuration present (values withheld)");
  service = createClient(projectUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9235");
  context = await browser.newContext();
  await checkProtectedPages("Unauthenticated");
  await checkProtectedMutations("Unauthenticated");
  const anonymous = createClient(projectUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await checkTableIsolation(anonymous, "Anonymous RLS");

  currentCheck = "create marked temporary nonadmin Auth user";
  const { data: created, error: creationError } = await service.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { certification_marker: marker },
  });
  if (created?.user?.id) createdUserId = created.user.id;
  check(!creationError && createdUserId && created.user.email === email, currentCheck);
  const { data: membership, error: membershipError } = await service.from("admin_users").select("user_id").eq("user_id", createdUserId).maybeSingle();
  check(!membershipError && !membership, "temporary Auth user has no admin authorization");

  const page = await context.newPage();
  page.on("pageerror", () => { pageErrors += 1; });
  await page.goto(`${origin}/admin/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(`${password}-wrong`);
  currentCheck = "incorrect-password UI login returns 401";
  const incorrectResponse = page.waitForResponse((response) => response.url() === `${origin}/api/admin/auth/login`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  check((await incorrectResponse).status() === 401, currentCheck);
  await page.getByRole("alert").filter({ hasText: "not accepted" }).waitFor();
  await page.getByLabel("Password", { exact: true }).fill(password);
  currentCheck = "valid nonadmin credentials rejected by login UI with 403";
  const rejectedResponse = page.waitForResponse((response) => response.url() === `${origin}/api/admin/auth/login`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  check((await rejectedResponse).status() === 403, currentCheck);
  await page.getByRole("alert").filter({ hasText: "not authorized" }).waitFor();
  check(new URL(page.url()).pathname === "/admin/login", "nonadmin remains on login page with authorization error");
  const loginCookies = await context.cookies(origin);
  check(!loginCookies.some((cookie) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name) && cookie.value), "rejected nonadmin login leaves no auth-token cookies");

  const cookieJar = new Map();
  const nonadmin = createServerClient(projectUrl, publishableKey, {
    cookieOptions: { path: "/", httpOnly: true, secure: false, sameSite: "lax" },
    cookies: {
      getAll() { return [...cookieJar.values()].map(({ name, value }) => ({ name, value })); },
      setAll(values) {
        for (const cookie of values) {
          if (!cookie.value || cookie.options?.maxAge === 0) cookieJar.delete(cookie.name);
          else cookieJar.set(cookie.name, cookie);
        }
      },
    },
  });
  const { data: session, error: signInError } = await nonadmin.auth.signInWithPassword({ email, password });
  check(!signInError && session.user?.id === createdUserId && cookieJar.size > 0, "genuine authenticated nonadmin session issued (values withheld)");
  await context.clearCookies();
  await context.addCookies([...cookieJar.values()].map(({ name, value }) => ({ name, value, url: origin, httpOnly: true, secure: false, sameSite: "Lax" })));
  await checkProtectedPages("Authenticated nonadmin");
  await checkProtectedMutations("Authenticated nonadmin");
  await checkTableIsolation(nonadmin, "Authenticated nonadmin RLS");
  check(pageErrors === 0, "isolated login browser has no uncaught page errors");
} catch {
  failed = true;
  console.error(`FAIL: ${currentCheck}. Sensitive details withheld.`);
} finally {
  if (createdUserId && service) {
    try {
      const { data, error } = await service.auth.admin.getUserById(createdUserId);
      if (error || data.user?.email !== email || data.user?.user_metadata?.certification_marker !== marker) {
        throw new Error("Cleanup identity check failed");
      }
      const { error: deletionError } = await service.auth.admin.deleteUser(createdUserId);
      if (deletionError) throw new Error("Cleanup failed");
      console.log("PASS: only the marked temporary nonadmin Auth user was deleted");
    } catch {
      failed = true;
      console.error("FAIL: temporary QA Auth user cleanup requires a marker-based audit; do not delete other users.");
    }
  }
  if (context) await context.close().catch(() => {});
  console.log(`Authorization certification: ${checks} checks passed; ${failed ? "incomplete" : "complete"}. Owner context untouched.`);
  console.log("SKIP: owner session refresh and logout reserved for final coordinated certification.");
  // Closing the shared CDP browser would disrupt the operator and other workflows.
  process.exit(failed ? 1 : 0);
}
