import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanText,
  hasValidImageSignature,
  validateContact,
  validateEstimate,
  validateGalleryMetadata,
  validateLeadUpdate,
  validatePhoto,
  validateTestimonial,
} from "../src/lib/validation.js";

const token = "22222222-2222-4222-8222-222222222222";

test("cleanText removes control characters and enforces length", () => {
  assert.equal(cleanText("  hello\u0000 world  ", 8), "hello wo");
});

test("a complete estimate payload is normalized and accepted", () => {
  const result = validateEstimate({
    submissionToken: token,
    firstName: "  Maria ",
    lastName: "Lopez",
    phone: "(661) 555-0123",
    email: "MARIA@example.com",
    propertyAddress: "100 Oak Street",
    city: "Bakersfield",
    zip: "93301",
    services: ["tree-trimming", "not-a-real-service"],
    urgency: "Flexible",
    jobDescription: "Branches extend over the driveway.",
    preferredContactMethod: "Phone",
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.data.services, ["tree-trimming"]);
  assert.equal(result.data.email, "maria@example.com");
});

test("estimate validation returns field-specific errors", () => {
  const result = validateEstimate({ submissionToken: "bad", services: [], phone: "123", zip: "no" });
  assert.equal(result.valid, false);
  for (const key of ["submissionToken", "firstName", "phone", "propertyAddress", "city", "zip", "services", "urgency", "jobDescription", "preferredContactMethod"]) assert.ok(result.errors[key]);
});

test("contact requests require reachable details and a useful message", () => {
  const invalid = validateContact({ submissionToken: token, firstName: "A", phone: "22", message: "short" });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.phone);
  assert.ok(invalid.errors.message);
});

test("photo validation checks type, extension, and size", () => {
  assert.equal(validatePhoto({ name: "tree.jpg", type: "image/jpeg", size: 1024 }), null);
  assert.match(validatePhoto({ name: "tree.exe", type: "image/jpeg", size: 1024 }), /JPG/);
  assert.match(validatePhoto({ name: "tree.jpg", type: "image/jpeg", size: 9 * 1024 * 1024 }), /8 MB/);
  assert.match(validatePhoto({ name: "tree.heic", type: "image/heic", size: 1024 }, { gallery: true }), /JPG/);
});

test("image signatures must match the claimed MIME type", () => {
  assert.equal(hasValidImageSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0x01]), "image/jpeg"), true);
  assert.equal(hasValidImageSignature(Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]), "image/jpeg"), false);
  assert.equal(hasValidImageSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
});

test("lead updates allow only defined workflow statuses", () => {
  assert.equal(validateLeadUpdate({ status: "won", internalNotes: "Approved" }).valid, true);
  assert.equal(validateLeadUpdate({ status: "deleted", internalNotes: "" }).valid, false);
});

test("gallery metadata requires useful alt text", () => {
  assert.equal(validateGalleryMetadata({ altText: "" }).valid, false);
  const result = validateGalleryMetadata({ altText: "Crew removing a tree", category: "Tree Removal", published: true });
  assert.equal(result.valid, true);
  assert.equal(result.data.published, true);
});

test("testimonials require identity, text, and valid source URL", () => {
  assert.equal(validateTestimonial({ customerName: "J.", testimonialText: "Great work on our property.", source: "Google", sourceUrl: "javascript:bad" }).valid, false);
  assert.equal(validateTestimonial({ customerName: "J.", testimonialText: "Great work on our property.", source: "Direct Customer" }).valid, true);
});
