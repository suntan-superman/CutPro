import test from "node:test";
import assert from "node:assert/strict";
import { formatPhoneInput, getBusinessPhone } from "../src/lib/phone.js";

test("formats US phone input as it is entered", () => {
  assert.equal(formatPhoneInput("661"), "661");
  assert.equal(formatPhoneInput("66160254"), "(661) 602-54");
  assert.equal(formatPhoneInput("661-343-7663"), "(661) 343-7663");
});

test("preserves an international dialing prefix without applying a US mask", () => {
  assert.equal(formatPhoneInput("+442071234567"), "+442071234567");
});

test("business display and dialing normalize the same US number in common formats", () => {
  for (const value of ["+12134661363", "+1 213-466-1363", "12134661363", "2134661363", "(213) 466-1363", " 213.466.1363 "]) {
    assert.deepEqual(getBusinessPhone(value), { phoneDisplay: "(213) 466-1363", phoneHref: "tel:+12134661363", phoneE164: "+12134661363" });
  }
  assert.equal(getBusinessPhone("6613437663").phoneDisplay, "(661) 343-7663");
  assert.equal(getBusinessPhone("6613437663").phoneHref, "tel:+16613437663");
});

test("invalid or international values keep raw display without inventing a US number", () => {
  assert.equal(getBusinessPhone("+44 20 7123 4567").phoneDisplay, "+44 20 7123 4567");
  assert.equal(getBusinessPhone("+44 20 7123 4567").phoneE164, "+442071234567");
  for (const value of ["", "call the office", "+1 213", "2134661363 ext 2"]) {
    assert.equal(getBusinessPhone(value).phoneDisplay, value);
    assert.equal(getBusinessPhone(value).phoneE164, null);
  }
});
