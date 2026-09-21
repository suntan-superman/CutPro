import test from "node:test";
import assert from "node:assert/strict";
import { logoutSession } from "../src/lib/supabase/logoutSession.js";

const supabaseUrl = "https://project.supabase.co";
const cookieOptions = { path: "/", httpOnly: true, sameSite: "lax", secure: true };
const authCookie = "sb-project-auth-token.0";

function cookieFixture(names = [authCookie]) {
  const values = new Map(names.map((name) => [name, "synthetic-test-value"]));
  const writes = [];
  return {
    values,
    writes,
    cookieStore: {
      getAll() { return [...values].map(([name, value]) => ({ name, value })); },
      set(name, value, options) {
        writes.push({ name, value, options });
        values.set(name, value);
      },
    },
  };
}

function assertExpired(fixture, name) {
  const write = fixture.writes.find((item) => item.name === name);
  assert.ok(write, "Auth cookie must be explicitly expired");
  assert.equal(write.value, "");
  assert.deepEqual(write.options, { ...cookieOptions, maxAge: 0, expires: new Date(0) });
}

test("successful signOut reports confirmed revocation and clears local auth cookies", async () => {
  const fixture = cookieFixture();
  let calls = 0;
  const result = await logoutSession({
    createClient: async () => ({ auth: { async signOut() { calls += 1; return { error: null }; } } }),
    cookieStore: fixture.cookieStore, supabaseUrl, cookieOptions,
  });
  assert.deepEqual(result, { revocationFailed: false });
  assert.equal(calls, 1);
  assertExpired(fixture, authCookie);
});

test("a returned revocation error still expires local auth cookies and reports failure", async () => {
  const fixture = cookieFixture();
  const result = await logoutSession({
    createClient: async () => ({ auth: { async signOut() { return { error: new Error("Synthetic remote rejection") }; } } }),
    cookieStore: fixture.cookieStore, supabaseUrl, cookieOptions,
  });
  assert.deepEqual(result, { revocationFailed: true });
  assertExpired(fixture, authCookie);
});

test("a thrown network error still expires local auth cookies and reports failure", async () => {
  const fixture = cookieFixture();
  const result = await logoutSession({
    createClient: async () => ({ auth: { async signOut() { throw new TypeError("Synthetic network unavailable"); } } }),
    cookieStore: fixture.cookieStore, supabaseUrl, cookieOptions,
  });
  assert.deepEqual(result, { revocationFailed: true });
  assertExpired(fixture, authCookie);
});

test("a failed client initialization still expires local auth cookies", async () => {
  const fixture = cookieFixture();
  const result = await logoutSession({
    createClient: async () => { throw new Error("Synthetic initialization failure"); },
    cookieStore: fixture.cookieStore, supabaseUrl, cookieOptions,
  });
  assert.deepEqual(result, { revocationFailed: true });
  assertExpired(fixture, authCookie);
});

test("cleanup expires only this project's auth and verifier chunks, including cookies changed during signOut", async () => {
  const targeted = [authCookie, "sb-project-auth-token.1", "sb-project-auth-token-code-verifier.0"];
  const unrelated = ["sb-other-auth-token.0", "preferences", "sb-project-auth-token-extra", "sb-project-auth-token.not-a-chunk"];
  const fixture = cookieFixture([...targeted, ...unrelated]);
  const newChunk = "sb-project-auth-token.2";
  await logoutSession({
    createClient: async () => ({ auth: { async signOut() {
      fixture.values.delete(authCookie);
      fixture.values.set(newChunk, "synthetic-new-chunk");
      return { error: new Error("Synthetic partial revocation") };
    } } }),
    cookieStore: fixture.cookieStore, supabaseUrl, cookieOptions,
  });
  const expected = [...targeted, newChunk, "sb-project-auth-token", "sb-project-auth-token-code-verifier"];
  assert.deepEqual(fixture.writes.map(({ name }) => name).sort(), expected.sort());
  for (const name of expected) assertExpired(fixture, name);
  for (const name of unrelated) assert.equal(fixture.values.get(name), "synthetic-test-value");
});

test("missing configuration does not clear unrelated cookies or invent a revocation failure", async () => {
  const fixture = cookieFixture(["preferences", "sb-other-auth-token.0"]);
  const result = await logoutSession({
    createClient: async () => null,
    cookieStore: fixture.cookieStore, supabaseUrl: undefined, cookieOptions,
  });
  assert.deepEqual(result, { revocationFailed: false });
  assert.deepEqual(fixture.writes, []);
});
