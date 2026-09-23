import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
test("static map is a compact local WebP with matching component dimensions", async () => {
  const image = await readFile(new URL("public/maps/bakersfield.webp", root));
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 866);
  assert.ok(image.byteLength < 200000);
  const component = await readFile(new URL("src/components/ui/ServiceAreaMap.js", root), "utf8");
  assert.match(component, /width=\{1200\}/);
  assert.match(component, /height=\{866\}/);
  assert.match(component, /src="\/maps\/bakersfield.webp"/);
  assert.match(component, /www.openstreetmap.org\/copyright/);
  assert.match(component, /not a service boundary/);
  assert.doesNotMatch(component, /iframe|use client|googleapis|access_token/);
});

test("map source includes real geographic features and open-data license", async () => {
  const data = JSON.parse(gunzipSync(await readFile(new URL("public/maps/bakersfield-source.json.gz", root))));
  assert.equal(data.cutpro.license, "https://opendatacommons.org/licenses/odbl/1-0/");
  assert.ok(data.elements.some((item) => item.tags?.name === "Bakersfield" && item.lat > 35 && item.lon < -118));
  assert.ok(data.elements.some((item) => item.tags?.waterway === "river" && item.geometry.length > 2));
  assert.ok(data.elements.some((item) => item.tags?.ref === "CA 99"));
});

test("home and both service-area pages share one map component", async () => {
  for (const path of ["src/app/page.js", "src/app/service-areas/page.js", "src/app/service-areas/[slug]/page.js"]) {
    const content = await readFile(new URL(path, root), "utf8");
    assert.match(content, /<ServiceAreaMap \/>/);
    assert.doesNotMatch(content, /className="(?:area-map|map-ring|map-road)/);
  }
});
