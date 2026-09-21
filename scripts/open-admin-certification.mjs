import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// An isolated, Git-ignored profile lets the operator enter their own password.
// Never capture credentials, network bodies, storageState, HARs, or traces here.
const origin = "http://127.0.0.1:3000";
const profile = fileURLToPath(new URL("../artifacts/admin-certification-profile/", import.meta.url));
const downloadsPath = fileURLToPath(new URL("../artifacts/admin-certification-downloads/", import.meta.url));

try {
  const response = await fetch(`${origin}/admin/login`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Local login page is unavailable");
  mkdirSync(profile, { recursive: true });
  mkdirSync(downloadsPath, { recursive: true });
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1365, height: 950 },
    downloadsPath,
    args: ["--remote-debugging-address=127.0.0.1", "--remote-debugging-port=9235"],
  });
  const closed = new Promise((resolve) => context.once("close", resolve));
  const page = context.pages()[0] || await context.newPage();
  await page.goto(`${origin}/admin/login`);
  console.log("CutPro's isolated local certification browser is ready.");
  console.log("Enter your credentials only into the displayed CutPro sign-in form.");
  console.log("This helper does not read login fields or log credentials/session tokens.");
  page.waitForResponse((response) => response.url() === `${origin}/api/admin/auth/login` && response.status() === 200, { timeout: 0 })
    .then(() => console.log("PASS: operator-entered password sign-in returned HTTP 200."))
    .catch(() => {});
  page.waitForURL(`${origin}/admin`, { timeout: 0 })
    .then(async () => {
      console.log("Admin dashboard reached. Leave this browser open for certification.");
      const authCookies = (await context.cookies(origin)).filter((cookie) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name));
      console.log(`Auth cookies present: ${authCookies.length > 0}; all HttpOnly: ${authCookies.length > 0 && authCookies.every((cookie) => cookie.httpOnly)}. Values withheld.`);
    })
    .catch(() => {});
  await closed;
} catch {
  console.error("Certification browser could not start. Check the local server and Chrome installation; sensitive details are withheld.");
  process.exitCode = 1;
}
