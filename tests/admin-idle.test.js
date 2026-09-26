import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_IDLE_WARNING_MS,
  formatIdleRemaining,
  getAdminIdleState,
} from "../src/lib/adminIdle.js";

test("admin idle state remains active, warns, then expires", () => {
  const now = 1_000_000;
  assert.deepEqual(getAdminIdleState(now, now), {
    expired: false,
    warning: false,
    remainingMs: ADMIN_IDLE_TIMEOUT_MS,
    remainingSeconds: ADMIN_IDLE_TIMEOUT_MS / 1000,
  });
  const warning = getAdminIdleState(now, now + ADMIN_IDLE_TIMEOUT_MS - ADMIN_IDLE_WARNING_MS);
  assert.equal(warning.expired, false);
  assert.equal(warning.warning, true);
  assert.equal(warning.remainingSeconds, ADMIN_IDLE_WARNING_MS / 1000);
  assert.equal(getAdminIdleState(now, now + ADMIN_IDLE_TIMEOUT_MS).expired, true);
});

test("invalid activity timestamps are treated as expired", () => {
  assert.equal(getAdminIdleState("not-a-timestamp").expired, true);
  assert.equal(getAdminIdleState(0).expired, true);
});

test("idle countdown is formatted as minutes and seconds", () => {
  assert.equal(formatIdleRemaining(301), "5:01");
  assert.equal(formatIdleRemaining(60), "1:00");
  assert.equal(formatIdleRemaining(0), "0:00");
});
