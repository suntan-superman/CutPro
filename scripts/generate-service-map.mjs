// Manual asset refresh only: normal builds never contact a map provider.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const source = new URL("public/maps/bakersfield-source.json.gz", root);
const bounds = { south: 35.265, west: -119.20, north: 35.465, east: -118.86 };
const { south, west, north, east } = bounds;
const width = 1200;
const mercator = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const height = Math.round(width * (mercator(north) - mercator(south)) / ((east - west) * Math.PI / 180));
const point = ({ lat, lon }) => [
  (lon - west) / (east - west) * width,
  (mercator(north) - mercator(lat)) / (mercator(north) - mercator(south)) * height,
];
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
await mkdir(new URL("public/maps/", root), { recursive: true });
let data;
if (process.argv.includes("--refresh")) {
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:60];(way[highway~"^(motorway|trunk|primary|secondary|tertiary|residential)$"](${bbox});way[waterway=river](${bbox});way[leisure=park](${bbox});way[natural=water](${bbox});node[place~"^(city|town|village|suburb)$"](${bbox}););out geom;`;
  const response = await fetch("https://overpass.private.coffee/api/interpreter", {
    method: "POST", body: new URLSearchParams({ data: query }),
    headers: { "User-Agent": "CutPro-static-service-map/1.0 (https://cutpro-tree-service.netlify.app)" },
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw new Error(`Map data request failed: ${response.status}`);
  data = await response.json();
  if (data.remark || !data.elements?.some((element) => element.tags?.name === "Bakersfield")) throw new Error("Incomplete map data; keeping existing assets.");
  data.cutpro = { bounds, license: "https://opendatacommons.org/licenses/odbl/1-0/", attribution: "© OpenStreetMap contributors" };
  await writeFile(source, gzipSync(JSON.stringify(data)));
} else {
  data = JSON.parse(gunzipSync(await readFile(source)));
}

const ways = data.elements.filter((element) => element.geometry?.length > 1);
const path = (way) => way.geometry.map((coordinate, index) => `${index ? "L" : "M"}${point(coordinate).map((number) => number.toFixed(1)).join(",")}`).join("");
const draw = (items, attributes, close = false) => items.map((way) => `<path d="${path(way)}${close ? "Z" : ""}" ${attributes}/>`).join("\n");
const roads = (types) => ways.filter((way) => types.includes(way.tags?.highway));
const major = roads(["motorway", "trunk"]);
const minor = roads(["primary", "secondary", "tertiary"]);
const labels = [];
const selectedPlaces = ["Bakersfield", "Oildale", "Rosedale", "Greenacres"];
for (const name of selectedPlaces) {
  const place = data.elements.find((element) => element.type === "node" && element.tags?.name === name);
  if (!place) continue;
  const [x, y] = point(place);
  if (name === "Bakersfield") {
    labels.push(`<circle cx="${x}" cy="${y}" r="13" fill="#173f32" stroke="white" stroke-width="5"/><rect x="${x - 159}" y="${y + 23}" width="318" height="90" rx="12" fill="#173f32"/><text x="${x}" y="${y + 67}" fill="white" font-size="42" font-weight="700">Bakersfield</text><text x="${x}" y="${y + 94}" fill="#d3e5bc" font-size="19" letter-spacing="3">CALIFORNIA</text>`);
  } else {
    labels.push(`<text x="${x}" y="${y}" fill="#41584b" font-size="23" font-weight="600" stroke="#f3f2e9" stroke-width="6" paint-order="stroke">${escape(name)}</text>`);
  }
}
// Anchor route shields to actual road geometry, away from the city labels.
for (const [ref, target] of [["99", { lat: 35.44, lon: -119.075 }], ["58", { lat: 35.352, lon: -118.92 }], ["178", { lat: 35.397, lon: -118.91 }]]) {
  const [tx, ty] = point(target);
  const candidates = major.filter((way) => way.tags?.ref?.split(";").some((value) => value.trim() === `CA ${ref}`)).flatMap((way) => way.geometry).map(point);
  candidates.sort((a, b) => Math.hypot(a[0] - tx, a[1] - ty) - Math.hypot(b[0] - tx, b[1] - ty));
  if (!candidates.length) continue;
  const [x, y] = candidates[0];
  labels.unshift(`<rect x="${x - 24}" y="${y - 17}" width="48" height="34" rx="8" fill="#fffefa" stroke="#708674" stroke-width="2"/><text x="${x}" y="${y + 7}" font-size="21" fill="#274a3a" font-weight="700">${ref}</text>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<title>Bakersfield and surrounding neighborhoods</title>
<desc>Static geographic context, not a service boundary. Map data © OpenStreetMap contributors, https://www.openstreetmap.org/copyright</desc>
<rect width="100%" height="100%" fill="#eeeee4"/>
<g stroke-linejoin="round" stroke-linecap="round">
${draw(ways.filter((way) => way.tags?.leisure === "park"), 'fill="#d8e3c7" stroke="#cfddbd" stroke-width="1"', true)}
${draw(ways.filter((way) => way.tags?.natural === "water"), 'fill="#adcccd" stroke="none"', true)}
${draw(roads(["residential"]), 'fill="none" stroke="#ffffff" stroke-width="1.8"')}
${draw(ways.filter((way) => way.tags?.waterway === "river"), 'fill="none" stroke="#94bfc3" stroke-width="7"')}
${draw(minor, 'fill="none" stroke="#d0d3c5" stroke-width="5.5"')}
${draw(minor, 'fill="none" stroke="#fffefa" stroke-width="3.3"')}
${draw(major, 'fill="none" stroke="#b4b69a" stroke-width="9"')}
${draw(major, 'fill="none" stroke="#e8d6a3" stroke-width="5.5"')}
</g><g text-anchor="middle" font-family="Arial, sans-serif">${labels.join("\n")}</g>
<g transform="translate(1137 51)" fill="#3d5849" font-family="Arial, sans-serif" text-anchor="middle"><text font-size="19" font-weight="700">N</text><path d="M0 12L-9 39L0 33L9 39Z"/></g>
</svg>`;
await mkdir(new URL("artifacts/", root), { recursive: true });
await writeFile(new URL("artifacts/bakersfield-map.svg", root), svg);
await sharp(Buffer.from(svg)).webp({ quality: 88 }).toFile(fileURLToPath(new URL("public/maps/bakersfield.webp", root)));
console.log(`Rendered ${width} × ${height} Bakersfield map from ${data.elements.length} OpenStreetMap features.`);
