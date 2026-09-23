import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const origin = process.env.CUTPRO_QA_ORIGIN || "http://127.0.0.1:3012";
const routes = ["/", "/service-areas", "/service-areas/bakersfield"];
const output = new URL("../artifacts/service-map/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const mapRequests = [];
  page.on("request", (request) => {
    if (/overpass|tile\.openstreetmap|maps\.google/.test(request.url())) mapRequests.push(request.url());
  });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      assert.equal((await page.goto(`${origin}${route}`)).status(), 200);
      const map = page.locator(".service-area-map");
      assert.equal(await map.count(), 1);
      await map.scrollIntoViewIfNeeded();
      await map.locator("img").evaluate((image) => image.decode());
      assert.ok(await map.locator("img").evaluate((image) => image.naturalWidth > 300));
      assert.match(await map.innerText(), /not a service boundary/);
      assert.equal(await map.locator(".service-area-map-credit").getAttribute("href"), "https://www.openstreetmap.org/copyright");
      assert.equal(await map.getByRole("link", { name: /View larger map/ }).getAttribute("target"), "_blank");
      assert.equal(await page.locator(".map-ring, .map-road").count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} overflow at ${width}`);
      await map.screenshot({ path: fileURLToPath(new URL(`${route.replaceAll("/", "_") || "home"}-${width}.png`, output)) });
      console.log(`PASS ${route} at ${width}px`);
    }
  }
  assert.deepEqual(mapRequests, [], "Map should not contact third-party providers during page views");
  assert.equal((await fetch(`${origin}/maps/bakersfield.webp`)).status, 200);
  assert.equal((await fetch(`${origin}/maps/bakersfield-source.json.gz`)).status, 200);
  console.log("Static map certification passed: 12 page/viewport checks, local assets, no map-provider requests.");
} finally {
  await browser.close();
}
