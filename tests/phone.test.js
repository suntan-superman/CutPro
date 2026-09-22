import test from "node:test";
import assert from "node:assert/strict";
import { formatPhoneInput } from "../src/lib/phone.js";

test("formats US phone input as it is entered", () => {
  assert.equal(formatPhoneInput("661"), "661");
  assert.equal(formatPhoneInput("66160254"), "(661) 602-54");
  assert.equal(formatPhoneInput("661-343-7663"), "(661) 343-7663");
});

test("preserves an international dialing prefix without applying a US mask", () => {
  assert.equal(formatPhoneInput("+442071234567"), "+442071234567");
});
