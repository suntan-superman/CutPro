import test from "node:test";
import assert from "node:assert/strict";
import { getProjectAuthCookieNames, getSessionCookieOptions } from "../src/lib/supabase/sessionCookies.js";

test("session cookies are HttpOnly, same-site and Secure for HTTPS requests", () => {
  const options = getSessionCookieOptions(new Headers({ host: "cutpro.example", "x-forwarded-proto": "https" }), "http://localhost:3000");
  assert.deepEqual(options, { path: "/", httpOnly: true, sameSite: "lax", secure: true });
});

test("localhost and loopback cookies remain usable over local HTTP", () => {
  for (const host of ["localhost:3000", "test.localhost:3000", "127.0.0.1:3000", "[::1]:3000"]) {
    const options = getSessionCookieOptions(new Headers({ host, "x-forwarded-proto": "https" }), "https://cutpro.example");
    assert.equal(options.secure, false, host);
    assert.equal(options.httpOnly, true);
  }
});

test("configured HTTPS is used when no forwarded protocol is present", () => {
  assert.equal(getSessionCookieOptions(new Headers({ host: "cutpro.example" }), "https://cutpro.example").secure, true);
  assert.equal(getSessionCookieOptions(new Headers({ host: "cutpro.example" }), "http://cutpro.example").secure, false);
});

test("cookie clearing is restricted to this project's auth and verifier chunks", () => {
  const cookies = [
    "sb-project-auth-token", "sb-project-auth-token.0", "sb-project-auth-token.1",
    "sb-project-auth-token-code-verifier", "sb-project-auth-token-code-verifier.0",
    "sb-other-auth-token.0", "sb-project-auth-token-custom", "sb-project-auth-token.abc", "preferences",
  ].map((name) => ({ name, value: "not-a-real-cookie" }));
  assert.deepEqual(getProjectAuthCookieNames(cookies, "https://project.supabase.co").sort(), [
    "sb-project-auth-token", "sb-project-auth-token.0", "sb-project-auth-token.1",
    "sb-project-auth-token-code-verifier", "sb-project-auth-token-code-verifier.0",
  ].sort());
});

test("missing Supabase configuration does not clear unrelated cookies", () => {
  assert.deepEqual(getProjectAuthCookieNames([{ name: "preferences", value: "x" }], undefined), []);
});
