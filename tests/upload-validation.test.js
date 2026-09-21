import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { MAX_PHOTO_SIZE } from "../src/lib/validation.js";
import {
  processPhotoInput,
  readValidatedPhoto,
  UploadValidationError,
} from "../src/lib/uploadValidation.js";

test("photo input validation rejects empty, oversized, and disallowed files before reading bytes", async () => {
  for (const file of [
    { name: "empty.jpg", type: "image/jpeg", size: 0 },
    { name: "large.jpg", type: "image/jpeg", size: MAX_PHOTO_SIZE + 1 },
    { name: "program.exe", type: "image/jpeg", size: 10 },
    { name: "phone.heic", type: "image/heic", size: 10 },
  ]) {
    await assert.rejects(readValidatedPhoto({ ...file, arrayBuffer() { assert.fail("Invalid metadata must fail before reading the file"); } }, { gallery: true }), UploadValidationError);
  }
});

test("photo input validation rejects MIME spoofing without returning input contents", async () => {
  const privateContents = "not-an-image-and-must-not-be-echoed";
  const file = new File([privateContents], "photo.jpg", { type: "image/jpeg" });
  await assert.rejects(readValidatedPhoto(file, { gallery: true }), (error) => {
    assert.ok(error instanceof UploadValidationError);
    assert.match(error.message, /contents did not match/);
    assert.equal(error.message.includes(privateContents), false);
    return true;
  });
});

test("correct magic bytes do not let malformed JPEG, PNG, or WebP pass the image decoder", async () => {
  const inputs = [
    ["photo.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x01])],
    ["photo.png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["photo.webp", "image/webp", Buffer.from("RIFF0000WEBP")],
  ];
  for (const [name, type, input] of inputs) {
    const buffer = await readValidatedPhoto(new File([input], name, { type }), { gallery: true });
    await assert.rejects(processPhotoInput(() => sharp(buffer).webp().toBuffer()), (error) => {
      assert.ok(error instanceof UploadValidationError);
      assert.equal(error.message, "This photo could not be read. Choose a valid JPG, PNG, or WebP image.");
      assert.ok(error.cause instanceof Error);
      return true;
    });
  }
});

test("supported valid photos retain normal image processing", async () => {
  const source = await sharp({ create: { width: 12, height: 8, channels: 3, background: "#306020" } }).png().toBuffer();
  const buffer = await readValidatedPhoto(new File([source], "tree.png", { type: "image/png" }), { gallery: true });
  assert.deepEqual(buffer, source);
  const output = await processPhotoInput(() => sharp(buffer).rotate().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer());
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 12);
  assert.equal(metadata.height, 8);
});

test("known decoder-data failures are classified without exposing decoder diagnostics", async () => {
  for (const message of [
    "Input buffer contains unsupported image format",
    "Input image exceeds pixel limit",
    "VipsJpeg: Premature end of input file",
    "vipspng: libpng read error",
    "webp: unable to parse image",
  ]) {
    await assert.rejects(processPhotoInput(() => { throw new Error(message); }), (error) => {
      assert.ok(error instanceof UploadValidationError);
      assert.notEqual(error.message, message);
      return true;
    });
  }
});

test("storage, database, resource, programming, and lookalike errors are not client validation errors", async () => {
  for (const error of [
    new Error("The photo could not be stored."),
    new Error("database unavailable"),
    new Error("out of memory"),
    new Error("VipsJpeg: out of memory"),
    new Error("Invalid resize dimensions"),
    new Error("database: Input buffer has corrupt header"),
    Object.assign(new Error("operational failure"), { name: "UploadValidationError" }),
    { message: "Input buffer has corrupt header", name: "UploadValidationError" },
  ]) {
    await assert.rejects(processPhotoInput(() => { throw error; }), (actual) => {
      assert.equal(actual, error);
      assert.equal(actual instanceof UploadValidationError, false);
      return true;
    });
  }
});

test("file-read failures preserve their operational classification", async () => {
  const failure = new Error("File buffer unavailable");
  const file = { name: "tree.jpg", type: "image/jpeg", size: 100, arrayBuffer() { throw failure; } };
  await assert.rejects(readValidatedPhoto(file, { gallery: true }), (error) => error === failure);
});
