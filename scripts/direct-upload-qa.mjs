import assert from "node:assert/strict";
import sharp from "sharp";

// Deterministic synthetic 12-megapixel photographs, not padding appended to a
// tiny image. High-entropy pixels make the genuinely encoded JPEG exceed the
// old buffered-function binary-body ceiling while remaining below 8 MiB.
export async function makePhonePhoto({ name, seed = 1, marker = "CUTPRO SYNTHETIC QA ONLY" }) {
  const pixels = Buffer.allocUnsafe(4000 * 3000 * 3);
  let state = seed >>> 0 || 1;
  for (let index = 0; index < pixels.length; index += 1) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    pixels[index] = state & 255;
  }
  for (const quality of [80, 75, 70, 65]) {
    const buffer = await sharp(pixels, { raw: { width: 4000, height: 3000, channels: 3 } })
      .withExif({ IFD0: { Artist: "CUTPRO QA ONLY", ImageDescription: marker } }).jpeg({ quality }).toBuffer();
    if (buffer.length > 4.5 * 1024 * 1024 && buffer.length <= 8 * 1024 * 1024) return { name, mimeType: "image/jpeg", buffer };
  }
  throw new Error("Synthetic phone-image size must be between 4.5 and 8 MiB");
}

// Keep requests and capabilities in memory only. Returned diagnostics are only
// counts and sizes; callers must never log finalBody or signed upload URLs.
export function observeDirectUploadTraffic(page, { origin, projectUrl, base }) {
  const pending = [];
  const sessionIds = new Set();
  const metrics = { appJsonPosts: 0, invalidAppRequests: 0, directUploadSizes: [], storageCookieSent: false, storageReferrerSent: false };
  let finalBody = null;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() !== "POST" || url.origin !== origin || !(url.pathname === base || url.pathname.startsWith(`${base}/uploads`))) return;
    const body = request.postData() || "";
    metrics.appJsonPosts += 1;
    if (!request.headers()["content-type"]?.startsWith("application/json") || !body || Buffer.byteLength(body) > 64 * 1024) metrics.invalidAppRequests += 1;
    try {
      const parsed = JSON.parse(body);
      if (url.pathname === `${base}/uploads`) sessionIds.add(parsed.requestId);
      if (url.pathname === base) finalBody = body;
    } catch { metrics.invalidAppRequests += 1; }
  });
  page.on("requestfinished", (request) => {
    const url = new URL(request.url());
    const project = new URL(projectUrl);
    const directHost = project.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
    if (request.method() !== "PUT" || ![project.hostname, directHost].includes(url.hostname) || !url.pathname.startsWith("/storage/v1/object/upload/sign/")) return;
    pending.push((async () => {
      const sizes = await request.sizes();
      // Chromium may report -1 for streamed Fetch bodies after a completed
      // request. The buffer is read only to measure this in-memory QA fixture;
      // it is never retained, logged, or written to an artifact.
      const headers = await request.allHeaders();
      const headerSize = Number(headers["content-length"] || 0);
      const measuredBodySize = sizes.requestBodySize > 0 ? sizes.requestBodySize : (headerSize || request.postDataBuffer()?.length || 0);
      metrics.directUploadSizes.push(measuredBodySize);
      metrics.storageCookieSent ||= Boolean(headers.cookie);
      metrics.storageReferrerSent ||= Boolean(headers.referer);
    })().catch(() => { metrics.invalidAppRequests += 1; }));
  });
  return {
    sessionIds,
    get finalBody() { return finalBody; },
    async certify({ minimumLargePhotos = 1 } = {}) {
      await Promise.all(pending);
      assert.equal(metrics.invalidAppRequests, 0, "CutPro upload requests must contain only small JSON");
      assert(metrics.appJsonPosts > 0, "Expected upload authorization/metadata requests");
      assert(metrics.directUploadSizes.filter((size) => size > 4.5 * 1024 * 1024 && size <= 8 * 1024 * 1024).length >= minimumLargePhotos, "Expected genuinely large photos to upload directly to Supabase");
      assert.equal(metrics.storageCookieSent, false, "CutPro cookies must not travel to Storage");
      assert.equal(metrics.storageReferrerSent, false, "Storage upload must omit page referrer");
      return { appJsonPosts: metrics.appJsonPosts, directUploads: metrics.directUploadSizes.length, largeDirectUploads: metrics.directUploadSizes.filter((size) => size > 4.5 * 1024 * 1024).length };
    },
  };
}
